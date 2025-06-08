import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from sqlalchemy import func
from app import db
from models import Transaction, User
import logging


def generate_forecast(user_id, days=30):
    """
    Generate cash balance forecast for the next 7-30 days
    Optimized for irregular income patterns common in Botswana
    
    Args:
        user_id (int): User ID
        days (int): Number of days to forecast (default 30)
    
    Returns:
        dict: Forecast data including daily balances and key insights
    """
    try:
        # Get user's transaction history
        transactions = Transaction.query.filter_by(user_id=user_id)\
                                      .order_by(Transaction.transaction_date.desc())\
                                      .limit(200).all()  # Last 200 transactions for analysis
        
        if not transactions:
            return generate_empty_forecast(days)
        
        # Convert to DataFrame for analysis
        df = pd.DataFrame([{
            'date': t.transaction_date,
            'amount': t.amount,
            'category': t.category,
            'is_income': t.amount > 0
        } for t in transactions])
        
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date')
        
        # Calculate current balance
        current_balance = df['amount'].sum()
        
        # Analyze patterns
        income_analysis = analyze_income_patterns(df)
        expense_analysis = analyze_expense_patterns(df)
        
        # Generate daily forecasts
        forecast_dates = [(datetime.now() + timedelta(days=i)).date() for i in range(1, days + 1)]
        daily_forecasts = []
        
        running_balance = current_balance
        
        for date in forecast_dates:
            # Predict daily income and expenses
            daily_income = predict_daily_income(date, income_analysis)
            daily_expenses = predict_daily_expenses(date, expense_analysis)
            
            daily_net = daily_income + daily_expenses  # expenses are negative
            running_balance += daily_net
            
            daily_forecasts.append({
                'date': date.isoformat(),
                'predicted_income': daily_income,
                'predicted_expenses': abs(daily_expenses),
                'net_change': daily_net,
                'predicted_balance': running_balance,
                'confidence': calculate_prediction_confidence(date, income_analysis, expense_analysis)
            })
        
        # Identify potential shortfalls
        shortfalls = [day for day in daily_forecasts if day['predicted_balance'] < 0]
        
        # Calculate key insights
        insights = generate_forecast_insights(daily_forecasts, income_analysis, expense_analysis)
        
        return {
            'current_balance': current_balance,
            'forecast_period': days,
            'daily_forecasts': daily_forecasts,
            'shortfalls': shortfalls,
            'insights': insights,
            'income_analysis': income_analysis,
            'expense_analysis': expense_analysis,
            'generated_at': datetime.now().isoformat()
        }
        
    except Exception as e:
        logging.error(f"Error generating forecast for user {user_id}: {str(e)}")
        return generate_empty_forecast(days)


def analyze_income_patterns(df):
    """Analyze income patterns for irregular earners"""
    income_df = df[df['is_income'] == True].copy()
    
    if income_df.empty:
        return {
            'average_daily': 0,
            'frequency_days': 30,
            'variability': 'high',
            'pattern_type': 'no_data',
            'last_income_days_ago': None
        }
    
    # Calculate income statistics
    total_income = income_df['amount'].sum()
    days_span = (df['date'].max() - df['date'].min()).days or 1
    average_daily = total_income / days_span
    
    # Analyze frequency
    income_dates = income_df['date'].dt.date.unique()
    if len(income_dates) > 1:
        date_diffs = np.diff(sorted(income_dates))
        avg_frequency = np.mean([diff.days for diff in date_diffs])
    else:
        avg_frequency = 30  # Default assumption
    
    # Determine pattern type
    income_amounts = income_df['amount'].values
    cv = np.std(income_amounts) / np.mean(income_amounts) if np.mean(income_amounts) > 0 else 1
    
    if cv < 0.2:
        pattern_type = 'regular'
        variability = 'low'
    elif cv < 0.5:
        pattern_type = 'semi_regular'
        variability = 'medium'
    else:
        pattern_type = 'irregular'
        variability = 'high'
    
    # Days since last income
    last_income_date = income_df['date'].max()
    days_since_income = (datetime.now() - last_income_date).days
    
    return {
        'average_daily': average_daily,
        'frequency_days': avg_frequency,
        'variability': variability,
        'pattern_type': pattern_type,
        'last_income_days_ago': days_since_income,
        'typical_amount': np.median(income_amounts),
        'income_consistency': 1 - cv  # Higher = more consistent
    }


def analyze_expense_patterns(df):
    """Analyze expense patterns"""
    expense_df = df[df['is_income'] == False].copy()
    
    if expense_df.empty:
        return {
            'average_daily': 0,
            'pattern_type': 'no_data',
            'variability': 'low',
            'categories': {}
        }
    
    # Calculate expense statistics
    total_expenses = abs(expense_df['amount'].sum())
    days_span = (df['date'].max() - df['date'].min()).days or 1
    average_daily = total_expenses / days_span
    
    # Analyze by category
    category_analysis = {}
    for category in expense_df['category'].dropna().unique():
        cat_expenses = expense_df[expense_df['category'] == category]['amount']
        category_analysis[category] = {
            'total': abs(cat_expenses.sum()),
            'average': abs(cat_expenses.mean()),
            'frequency': len(cat_expenses)
        }
    
    # Determine variability
    daily_expenses = expense_df.groupby(expense_df['date'].dt.date)['amount'].sum()
    cv = np.std(daily_expenses) / np.mean(daily_expenses) if np.mean(daily_expenses) != 0 else 0
    
    if cv < 0.3:
        variability = 'low'
        pattern_type = 'regular'
    elif cv < 0.6:
        variability = 'medium'
        pattern_type = 'semi_regular'
    else:
        variability = 'high'
        pattern_type = 'irregular'
    
    return {
        'average_daily': average_daily,
        'pattern_type': pattern_type,
        'variability': variability,
        'categories': category_analysis,
        'expense_consistency': 1 - cv
    }


def predict_daily_income(date, income_analysis):
    """Predict income for a specific date"""
    if income_analysis['pattern_type'] == 'no_data':
        return 0
    
    # Day of week effects (many informal workers get paid on specific days)
    weekday = date.weekday()  # 0 = Monday
    
    # Higher probability of income on Fridays (end of work week)
    day_multiplier = 1.0
    if weekday == 4:  # Friday
        day_multiplier = 1.5
    elif weekday in [5, 6]:  # Weekend
        day_multiplier = 0.7
    
    # Base daily income prediction
    base_income = income_analysis['average_daily'] * day_multiplier
    
    # Adjust based on days since last income
    days_since = income_analysis.get('last_income_days_ago', 0)
    frequency = income_analysis.get('frequency_days', 30)
    
    if days_since >= frequency:
        # Overdue for income - increase probability
        base_income *= 1.5
    elif days_since < frequency / 2:
        # Recent income - decrease probability
        base_income *= 0.3
    
    return max(0, base_income)


def predict_daily_expenses(date, expense_analysis):
    """Predict expenses for a specific date (returns negative value)"""
    if expense_analysis['pattern_type'] == 'no_data':
        return 0
    
    # Base daily expenses
    base_expenses = expense_analysis['average_daily']
    
    # Day of week effects
    weekday = date.weekday()
    
    # Higher expenses on weekends and Fridays
    day_multiplier = 1.0
    if weekday == 4:  # Friday
        day_multiplier = 1.2
    elif weekday in [5, 6]:  # Weekend
        day_multiplier = 1.3
    elif weekday == 0:  # Monday (start of week)
        day_multiplier = 1.1
    
    predicted_expenses = base_expenses * day_multiplier
    
    return -predicted_expenses  # Return as negative for expenses


def calculate_prediction_confidence(date, income_analysis, expense_analysis):
    """Calculate confidence level for predictions"""
    # Base confidence starts at 0.5
    confidence = 0.5
    
    # Increase confidence based on data consistency
    if income_analysis.get('income_consistency', 0) > 0.7:
        confidence += 0.2
    
    if expense_analysis.get('expense_consistency', 0) > 0.7:
        confidence += 0.2
    
    # Decrease confidence for far future dates
    days_ahead = (date - datetime.now().date()).days
    if days_ahead > 14:
        confidence -= 0.1
    if days_ahead > 21:
        confidence -= 0.1
    
    return max(0.1, min(0.9, confidence))


def generate_forecast_insights(daily_forecasts, income_analysis, expense_analysis):
    """Generate actionable insights from forecast data"""
    insights = []
    
    # Check for upcoming shortfalls
    shortfall_days = [day for day in daily_forecasts if day['predicted_balance'] < 0]
    if shortfall_days:
        first_shortfall = min(shortfall_days, key=lambda x: x['date'])
        insights.append({
            'type': 'warning',
            'title': 'Potential Cash Shortfall',
            'message': f"Your balance may go negative on {first_shortfall['date']}. Consider reducing expenses or finding additional income.",
            'severity': 'high',
            'actionable': True
        })
    
    # Income pattern insights
    if income_analysis['pattern_type'] == 'irregular':
        insights.append({
            'type': 'info',
            'title': 'Irregular Income Pattern',
            'message': 'Your income varies significantly. Consider building an emergency fund during high-income periods.',
            'severity': 'medium',
            'actionable': True
        })
    
    # Days since last income
    days_since_income = income_analysis.get('last_income_days_ago', 0)
    if days_since_income > 7:
        insights.append({
            'type': 'info',
            'title': 'Income Due',
            'message': f"It's been {days_since_income} days since your last income. Based on your pattern, income may be due soon.",
            'severity': 'low',
            'actionable': False
        })
    
    # Expense insights
    if expense_analysis['average_daily'] > income_analysis['average_daily']:
        insights.append({
            'type': 'warning',
            'title': 'Expenses Exceed Income',
            'message': 'Your daily expenses are higher than your daily income on average. Review your spending patterns.',
            'severity': 'high',
            'actionable': True
        })
    
    return insights


def generate_empty_forecast(days):
    """Generate empty forecast structure when no data available"""
    return {
        'current_balance': 0,
        'forecast_period': days,
        'daily_forecasts': [],
        'shortfalls': [],
        'insights': [{
            'type': 'info',
            'title': 'No Transaction Data',
            'message': 'Add some transactions to get personalized forecasts and insights.',
            'severity': 'low',
            'actionable': True
        }],
        'income_analysis': {'pattern_type': 'no_data'},
        'expense_analysis': {'pattern_type': 'no_data'},
        'generated_at': datetime.now().isoformat()
    }


def explain_forecast(user_id):
    """Generate detailed explanation of forecast methodology"""
    return {
        'methodology': {
            'income_prediction': 'We analyze your historical income patterns, including frequency and amounts, to predict future income. For irregular earners, we consider factors like days since last payment and typical payment cycles.',
            'expense_prediction': 'Daily expenses are predicted based on your spending history, with adjustments for day-of-week patterns (e.g., higher weekend spending).',
            'balance_calculation': 'Future balance = Current balance + Predicted income - Predicted expenses for each day.'
        },
        'factors_considered': [
            'Historical transaction patterns',
            'Income frequency and variability',
            'Day-of-week spending patterns',
            'Seasonal trends (where data available)',
            'Time since last income payment'
        ],
        'limitations': [
            'Predictions are based on historical patterns and may not account for unexpected events',
            'Accuracy decreases for longer forecast periods',
            'New income sources or expense categories may not be predicted',
            'Economic changes or personal circumstances may affect actual results'
        ],
        'confidence_factors': {
            'high_confidence': 'Regular income and expense patterns with sufficient historical data',
            'medium_confidence': 'Some regularity in patterns but with moderate variability',
            'low_confidence': 'Highly irregular patterns or limited historical data'
        }
    }
