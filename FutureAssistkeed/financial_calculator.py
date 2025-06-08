from models import Transaction
from datetime import datetime, timedelta
from sqlalchemy import func, extract, and_
from app import db
import statistics

class FinancialCalculator:
    
    @staticmethod
    def calculate_moving_average(days=30):
        """Calculate moving average for income and expenses with daily analysis"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Get all transactions within the period
        transactions = Transaction.query.filter(
            Transaction.date_created >= start_date,
            Transaction.date_created <= end_date
        ).order_by(Transaction.date_created.asc()).all()
        
        # Create daily totals for all days in the period
        daily_data = {}
        current_date = start_date.date()
        
        while current_date <= end_date.date():
            daily_data[current_date] = {'income': 0, 'expenses': 0}
            current_date += timedelta(days=1)
        
        # Fill in actual transaction data
        for transaction in transactions:
            date_key = transaction.date_created.date()
            if transaction.transaction_type == 'income':
                daily_data[date_key]['income'] += transaction.amount
            else:
                daily_data[date_key]['expenses'] += transaction.amount
        
        # Calculate daily patterns and averages
        daily_incomes = [data['income'] for data in daily_data.values()]
        daily_expenses = [data['expenses'] for data in daily_data.values()]
        daily_nets = [data['income'] - data['expenses'] for data in daily_data.values()]
        
        # Calculate statistics
        avg_income = statistics.mean(daily_incomes) if daily_incomes else 0
        avg_expenses = statistics.mean(daily_expenses) if daily_expenses else 0
        median_expenses = statistics.median(daily_expenses) if daily_expenses else 0
        
        # Calculate expense volatility (standard deviation)
        expense_volatility = statistics.stdev(daily_expenses) if len(daily_expenses) > 1 else 0
        
        return {
            'avg_daily_income': avg_income,
            'avg_daily_expenses': avg_expenses,
            'median_daily_expenses': median_expenses,
            'expense_volatility': expense_volatility,
            'avg_daily_net': avg_income - avg_expenses,
            'daily_data': daily_data,
            'daily_nets': daily_nets
        }
    
    @staticmethod
    def forecast_balance(days_ahead=30):
        """Advanced forecast based on historical patterns with daily shortfall analysis"""
        averages = FinancialCalculator.calculate_moving_average()
        current_balance = Transaction.get_current_balance()
        
        # Get more sophisticated daily patterns
        avg_income = averages['avg_daily_income']
        avg_expenses = averages['avg_daily_expenses']
        expense_volatility = averages['expense_volatility']
        
        # Day-by-day forecast with volatility consideration
        daily_forecast = []
        running_balance = current_balance
        shortfall_detected = False
        shortfall_day = None
        
        for day in range(1, days_ahead + 1):
            # Use historical patterns with some volatility
            projected_income = avg_income
            projected_expenses = avg_expenses
            
            # Add some variance for weekends (typically higher expenses)
            forecast_date = datetime.now() + timedelta(days=day)
            if forecast_date.weekday() >= 5:  # Weekend
                projected_expenses *= 1.2
            
            # Account for expense volatility (conservative estimate)
            if expense_volatility > 0:
                projected_expenses += expense_volatility * 0.5
            
            daily_net = projected_income - projected_expenses
            running_balance += daily_net
            
            daily_forecast.append({
                'day': day,
                'date': forecast_date.strftime('%Y-%m-%d'),
                'projected_income': projected_income,
                'projected_expenses': projected_expenses,
                'daily_net': daily_net,
                'running_balance': running_balance
            })
            
            # Check for shortfall
            if running_balance <= 0 and not shortfall_detected:
                shortfall_detected = True
                shortfall_day = day
        
        return {
            'current_balance': current_balance,
            'projected_balance': running_balance,
            'daily_net_change': avg_income - avg_expenses,
            'days_ahead': days_ahead,
            'daily_forecast': daily_forecast,
            'shortfall_detected': shortfall_detected,
            'shortfall_day': shortfall_day,
            'expense_volatility': expense_volatility
        }
    
    @staticmethod
    def generate_alerts():
        """Generate enhanced financial alerts with shortfall detection"""
        alerts = []
        current_balance = Transaction.get_current_balance()
        monthly_summary = Transaction.get_monthly_summary()
        averages = FinancialCalculator.calculate_moving_average()
        forecast = FinancialCalculator.forecast_balance()
        
        # CRITICAL: Shortfall detection alert
        if forecast['shortfall_detected']:
            shortfall_day = forecast['shortfall_day']
            shortfall_date = (datetime.now() + timedelta(days=shortfall_day)).strftime('%B %d, %Y')
            alerts.append({
                'type': 'critical',
                'message': f'⚠️ CRITICAL SHORTFALL ALERT: Your balance will reach zero on {shortfall_date} (Day {shortfall_day}). Immediate action required!',
                'priority': 1,
                'shortfall_day': shortfall_day,
                'shortfall_date': shortfall_date
            })
        
        # Low balance alerts (BWP currency)
        if current_balance < 100:
            alerts.append({
                'type': 'warning',
                'message': f'Low balance alert: Your current balance is P{current_balance:.2f}',
                'priority': 2
            })
        elif current_balance < 500:
            alerts.append({
                'type': 'caution',
                'message': f'Caution: Your current balance is P{current_balance:.2f}. Consider monitoring expenses.',
                'priority': 3
            })
        
        # Weekly shortfall warnings
        weekly_forecast = FinancialCalculator.forecast_balance(7)
        if weekly_forecast['shortfall_detected']:
            alerts.append({
                'type': 'warning',
                'message': f'Weekly shortfall warning: You may run out of money within 7 days (Day {weekly_forecast["shortfall_day"]})',
                'priority': 2
            })
        
        # Monthly spending alerts
        if monthly_summary['expenses'] > monthly_summary['income'] * 0.9:
            alerts.append({
                'type': 'warning',
                'message': f'High spending alert: You\'ve spent 90% or more of your monthly income.',
                'priority': 3
            })
        
        # Expense volatility alert
        if averages['expense_volatility'] > averages['avg_daily_expenses'] * 0.5:
            alerts.append({
                'type': 'caution',
                'message': f'Spending pattern alert: Your daily expenses vary significantly (P{averages["expense_volatility"]:.2f} volatility). Consider budgeting.',
                'priority': 4
            })
        
        # Daily burn rate alert
        if averages['avg_daily_expenses'] > 0 and current_balance / averages['avg_daily_expenses'] < 10:
            days_remaining = int(current_balance / averages['avg_daily_expenses'])
            alerts.append({
                'type': 'warning',
                'message': f'Burn rate alert: At current spending rate (P{averages["avg_daily_expenses"]:.2f}/day), you have approximately {days_remaining} days of funds remaining.',
                'priority': 2
            })
        
        # Positive alerts
        if monthly_summary['net'] > 0 and len([a for a in alerts if a['type'] in ['critical', 'warning']]) == 0:
            alerts.append({
                'type': 'info',
                'message': f'Excellent! You\'re saving P{monthly_summary["net"]:.2f} this month.',
                'priority': 5
            })
        
        # Sort alerts by priority (1 = highest)
        alerts.sort(key=lambda x: x.get('priority', 5))
        
        return alerts
    
    @staticmethod
    def get_chart_data():
        """Get data formatted for Chart.js"""
        # Last 30 days balance trend
        balance_data = []
        dates = []
        
        for i in range(29, -1, -1):
            date = datetime.now() - timedelta(days=i)
            dates.append(date.strftime('%m/%d'))
            
            # Calculate balance up to this date
            income = db.session.query(func.sum(Transaction.amount)).filter(
                Transaction.transaction_type == 'income',
                Transaction.date_created <= date
            ).scalar() or 0
            
            expenses = db.session.query(func.sum(Transaction.amount)).filter(
                Transaction.transaction_type == 'expense',
                Transaction.date_created <= date
            ).scalar() or 0
            
            balance_data.append(income - expenses)
        
        # Category breakdown for current month
        expense_categories = Transaction.get_category_breakdown('expense')
        
        return {
            'balance_trend': {
                'labels': dates,
                'data': balance_data
            },
            'expense_categories': {
                'labels': [cat['category'] for cat in expense_categories],
                'data': [cat['amount'] for cat in expense_categories]
            }
        }
