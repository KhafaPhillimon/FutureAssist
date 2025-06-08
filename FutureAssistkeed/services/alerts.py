from datetime import datetime, timedelta
from app import db
from models import User, Transaction, Alert
from services.forecasting import generate_forecast
import logging


def check_alerts(user_id):
    """
    Check for financial alerts based on forecast data and user preferences
    
    Args:
        user_id (int): User ID
    
    Returns:
        list: List of triggered alerts
    """
    try:
        user = User.query.get(user_id)
        if not user:
            return []
        
        # Generate forecast to check for potential issues
        forecast_data = generate_forecast(user_id, days=14)  # 2-week forecast for alerts
        
        alerts_triggered = []
        
        # Check for cash shortfall alerts
        shortfall_alerts = check_shortfall_alerts(user, forecast_data)
        alerts_triggered.extend(shortfall_alerts)
        
        # Check for spending pattern alerts
        spending_alerts = check_spending_alerts(user, forecast_data)
        alerts_triggered.extend(spending_alerts)
        
        # Check for income pattern alerts
        income_alerts = check_income_alerts(user, forecast_data)
        alerts_triggered.extend(income_alerts)
        
        # Save alerts to database
        for alert_data in alerts_triggered:
            alert = Alert(
                user_id=user_id,
                alert_type=alert_data['type'],
                message=alert_data['message'],
                severity=alert_data['severity'],
                metadata=str(alert_data.get('metadata', {}))
            )
            db.session.add(alert)
        
        if alerts_triggered:
            db.session.commit()
        
        return alerts_triggered
        
    except Exception as e:
        logging.error(f"Error checking alerts for user {user_id}: {str(e)}")
        return []


def check_shortfall_alerts(user, forecast_data):
    """Check for potential cash shortfall alerts"""
    alerts = []
    
    # Check if balance will go below user's threshold
    shortfalls = forecast_data.get('shortfalls', [])
    threshold = user.alert_threshold
    
    if shortfalls:
        first_shortfall = min(shortfalls, key=lambda x: x['date'])
        days_until = (datetime.fromisoformat(first_shortfall['date']) - datetime.now()).days
        
        severity = 'critical' if days_until <= 3 else 'high' if days_until <= 7 else 'medium'
        
        alerts.append({
            'type': 'cash_shortfall',
            'message': f"Warning: Your balance may go negative in {days_until} days. "
                      f"Expected shortfall: BWP {abs(first_shortfall['predicted_balance']):.2f}",
            'severity': severity,
            'metadata': {
                'days_until': days_until,
                'shortfall_amount': abs(first_shortfall['predicted_balance']),
                'shortfall_date': first_shortfall['date']
            }
        })
    
    # Check if balance will go below threshold (but not negative)
    low_balance_days = [
        day for day in forecast_data.get('daily_forecasts', [])
        if 0 < day['predicted_balance'] < threshold
    ]
    
    if low_balance_days and not shortfalls:  # Only alert if no shortfall alert
        first_low = min(low_balance_days, key=lambda x: x['date'])
        days_until = (datetime.fromisoformat(first_low['date']) - datetime.now()).days
        
        alerts.append({
            'type': 'low_balance',
            'message': f"Your balance will be low (BWP {first_low['predicted_balance']:.2f}) in {days_until} days. "
                      f"Consider reviewing your spending.",
            'severity': 'medium',
            'metadata': {
                'days_until': days_until,
                'predicted_balance': first_low['predicted_balance'],
                'threshold': threshold
            }
        })
    
    return alerts


def check_spending_alerts(user, forecast_data):
    """Check for unusual spending pattern alerts"""
    alerts = []
    
    expense_analysis = forecast_data.get('expense_analysis', {})
    
    # Check if daily spending is unusually high
    recent_transactions = Transaction.query.filter_by(user_id=user.id)\
                                         .filter(Transaction.amount < 0)\
                                         .filter(Transaction.transaction_date >= datetime.now() - timedelta(days=7))\
                                         .all()
    
    if recent_transactions:
        recent_spending = sum(abs(t.amount) for t in recent_transactions) / 7  # Daily average
        historical_average = expense_analysis.get('average_daily', 0)
        
        if recent_spending > historical_average * 1.5 and historical_average > 0:
            alerts.append({
                'type': 'high_spending',
                'message': f"Your spending has increased significantly. Daily average: BWP {recent_spending:.2f} "
                          f"vs usual BWP {historical_average:.2f}",
                'severity': 'medium',
                'metadata': {
                    'recent_daily': recent_spending,
                    'historical_daily': historical_average,
                    'increase_percent': ((recent_spending - historical_average) / historical_average * 100)
                }
            })
    
    return alerts


def check_income_alerts(user, forecast_data):
    """Check for income-related alerts"""
    alerts = []
    
    income_analysis = forecast_data.get('income_analysis', {})
    days_since_income = income_analysis.get('last_income_days_ago', 0)
    frequency = income_analysis.get('frequency_days', 30)
    
    # Alert if income is significantly overdue
    if days_since_income > frequency * 1.5 and frequency > 0:
        alerts.append({
            'type': 'income_overdue',
            'message': f"It's been {days_since_income} days since your last income. "
                      f"Your typical frequency is every {frequency} days.",
            'severity': 'medium',
            'metadata': {
                'days_since_income': days_since_income,
                'typical_frequency': frequency,
                'overdue_days': days_since_income - frequency
            }
        })
    
    # Alert for irregular income pattern with suggestions
    if income_analysis.get('pattern_type') == 'irregular' and income_analysis.get('income_consistency', 1) < 0.3:
        alerts.append({
            'type': 'irregular_income',
            'message': "Your income pattern is highly irregular. Consider building an emergency fund "
                      "and tracking income sources to better predict cash flow.",
            'severity': 'low',
            'metadata': {
                'consistency_score': income_analysis.get('income_consistency', 0),
                'pattern_type': income_analysis.get('pattern_type')
            }
        })
    
    return alerts


def get_financial_advice(user_id, alert_type='general'):
    """
    Generate localized financial advice based on alert type
    Tailored for Botswana context and informal workers
    
    Args:
        user_id (int): User ID
        alert_type (str): Type of alert to provide advice for
    
    Returns:
        dict: Financial advice and recommendations
    """
    try:
        user = User.query.get(user_id)
        if not user:
            return {'error': 'User not found'}
        
        # Get user's financial context
        forecast_data = generate_forecast(user_id, days=30)
        
        advice_map = {
            'cash_shortfall': get_shortfall_advice(user, forecast_data),
            'low_balance': get_low_balance_advice(user, forecast_data),
            'high_spending': get_spending_advice(user, forecast_data),
            'income_overdue': get_income_advice(user, forecast_data),
            'irregular_income': get_irregular_income_advice(user, forecast_data),
            'general': get_general_advice(user, forecast_data)
        }
        
        return advice_map.get(alert_type, advice_map['general'])
        
    except Exception as e:
        logging.error(f"Error getting financial advice for user {user_id}: {str(e)}")
        return {'error': 'Failed to generate advice'}


def get_shortfall_advice(user, forecast_data):
    """Advice for cash shortfall situations"""
    return {
        'title': 'Managing Cash Shortfalls',
        'immediate_actions': [
            'Review and reduce non-essential expenses immediately',
            'Contact creditors to negotiate payment delays if needed',
            'Look for quick income opportunities (piece jobs, selling items)',
            'Borrow from trusted family/friends as last resort'
        ],
        'medium_term_solutions': [
            'Create a detailed budget and stick to it',
            'Build an emergency fund (start with BWP 100-500)',
            'Diversify income sources to reduce dependency on single source',
            'Consider joining a savings group (motshelo) for financial support'
        ],
        'botswana_resources': [
            'Contact Citizen Entrepreneurial Development Agency (CEDA) for business support',
            'Look into Youth Development Fund (YDF) programs',
            'Check eligibility for government social programs',
            'Visit local bank branches for financial literacy programs'
        ],
        'priority': 'high',
        'estimated_reading_time': '3 minutes'
    }


def get_low_balance_advice(user, forecast_data):
    """Advice for low balance situations"""
    return {
        'title': 'Managing Low Balance',
        'immediate_actions': [
            'Track all expenses for the next week',
            'Postpone non-urgent purchases',
            'Look for ways to increase income this week',
            'Use cash instead of cards to control spending'
        ],
        'preventive_measures': [
            'Set up automatic savings (start with BWP 20-50 per week)',
            'Create spending categories and limits',
            'Plan purchases in advance',
            'Keep a small emergency fund separate from daily money'
        ],
        'local_tips': [
            'Buy in bulk from wholesalers to save money',
            'Use public transport or walk when possible',
            'Cook at home instead of buying takeaways',
            'Share expenses with neighbors (bulk buying, transport)'
        ],
        'priority': 'medium',
        'estimated_reading_time': '2 minutes'
    }


def get_spending_advice(user, forecast_data):
    """Advice for high spending patterns"""
    expense_analysis = forecast_data.get('expense_analysis', {})
    categories = expense_analysis.get('categories', {})
    
    # Find highest spending category
    top_category = max(categories.items(), key=lambda x: x[1]['total']) if categories else ('other', {})
    
    return {
        'title': 'Controlling Your Spending',
        'spending_analysis': {
            'highest_category': top_category[0],
            'amount': top_category[1].get('total', 0),
            'suggestion': get_category_specific_advice(top_category[0])
        },
        'immediate_actions': [
            'Write down all expenses for one week',
            'Identify which expenses are needs vs wants',
            'Set daily spending limits',
            'Use the 24-hour rule for non-essential purchases'
        ],
        'budgeting_tips': [
            'Use the 50/30/20 rule: 50% needs, 30% wants, 20% savings',
            'Pay yourself first - save before spending',
            'Use envelopes or separate accounts for different expense categories',
            'Review and adjust budget monthly'
        ],
        'botswana_context': [
            'Take advantage of month-end specials at stores',
            'Join bulk-buying groups in your community',
            'Use loyalty programs at major retailers',
            'Consider generic brands to save money'
        ],
        'priority': 'medium',
        'estimated_reading_time': '4 minutes'
    }


def get_income_advice(user, forecast_data):
    """Advice for income-related issues"""
    return {
        'title': 'Increasing and Stabilizing Income',
        'immediate_opportunities': [
            'Look for piece jobs in your community',
            'Sell skills or services (tutoring, repairs, crafts)',
            'Sell unused items',
            'Offer services like cleaning, gardening, or childcare'
        ],
        'skill_development': [
            'Learn digital skills (computer literacy, social media)',
            'Develop crafts or trades (sewing, woodwork, mechanics)',
            'Improve language skills (English for tourism/service jobs)',
            'Learn basic business and financial management'
        ],
        'formal_opportunities': [
            'Register your business with Companies and Intellectual Property Authority (CIPA)',
            'Apply for CEDA funding for small business development',
            'Look into Youth Development Fund programs',
            'Consider agricultural programs if you have land access'
        ],
        'income_diversification': [
            'Develop multiple income streams',
            'Balance formal and informal income sources',
            'Create passive income through small investments',
            'Build long-term client relationships'
        ],
        'priority': 'high',
        'estimated_reading_time': '5 minutes'
    }


def get_irregular_income_advice(user, forecast_data):
    """Advice for managing irregular income"""
    return {
        'title': 'Managing Irregular Income',
        'cash_flow_management': [
            'Create a minimum monthly budget based on lowest expected income',
            'Save extra money during high-income periods',
            'Keep 2-3 months of expenses as emergency fund',
            'Use percentage-based budgeting instead of fixed amounts'
        ],
        'planning_strategies': [
            'Track income patterns to predict lean periods',
            'Plan major expenses during high-income periods',
            'Build relationships with multiple income sources',
            'Create income calendar noting payment dates'
        ],
        'financial_tools': [
            'Join or start a savings group (motshelo)',
            'Use mobile money services for easy saving',
            'Consider informal lending circles',
            'Open a savings account with low minimum balance'
        ],
        'stress_management': [
            'Accept that irregular income is normal for many people',
            'Focus on what you can control (expenses, skills)',
            'Build supportive community networks',
            'Celebrate financial wins, however small'
        ],
        'priority': 'medium',
        'estimated_reading_time': '4 minutes'
    }


def get_general_advice(user, forecast_data):
    """General financial advice"""
    return {
        'title': 'Building Financial Wellness',
        'foundation_steps': [
            'Track all money coming in and going out',
            'Create a simple budget you can stick to',
            'Start saving something, even BWP 10 per week',
            'Learn basic financial concepts'
        ],
        'botswana_specific': [
            'Understand your rights as a consumer',
            'Learn about mobile money services (Orange Money, MyZaka)',
            'Know about government programs you may qualify for',
            'Understand basic banking services and fees'
        ],
        'long_term_goals': [
            'Build emergency fund (3-6 months expenses)',
            'Plan for major life events (education, health, family)',
            'Consider retirement planning, even small amounts',
            'Work towards home ownership or business development'
        ],
        'resources': [
            'Bank of Botswana financial literacy resources',
            'CEDA business development programs',
            'Community financial education workshops',
            'Mobile banking and digital payment training'
        ],
        'priority': 'low',
        'estimated_reading_time': '3 minutes'
    }


def get_category_specific_advice(category):
    """Get specific advice for spending categories"""
    advice_map = {
        'food': 'Consider meal planning, bulk buying, and cooking at home more often.',
        'transport': 'Look into public transport options, carpooling, or walking for short distances.',
        'communication': 'Review your data and airtime usage, consider cheaper plans or Wi-Fi options.',
        'entertainment': 'Look for free community events and activities, limit expensive outings.',
        'clothing': 'Shop during sales, consider second-hand options, and buy quality items that last.',
        'housing': 'Review utility usage, consider energy-saving measures, negotiate with service providers.'
    }
    
    return advice_map.get(category, 'Review this spending category and look for ways to reduce costs.')
