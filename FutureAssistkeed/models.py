from app import db
from datetime import datetime
from sqlalchemy import func

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    transaction_type = db.Column(db.String(10), nullable=False)  # 'income' or 'expense'
    category = db.Column(db.String(50), nullable=False)
    date_created = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Transaction {self.description}: {self.amount}>'
    
    @staticmethod
    def get_current_balance():
        """Calculate current balance from all transactions"""
        income = db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.transaction_type == 'income'
        ).scalar() or 0
        
        expenses = db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.transaction_type == 'expense'
        ).scalar() or 0
        
        return income - expenses
    
    @staticmethod
    def get_monthly_summary():
        """Get monthly income and expense totals"""
        from sqlalchemy import extract
        
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        monthly_income = db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.transaction_type == 'income',
            extract('month', Transaction.date_created) == current_month,
            extract('year', Transaction.date_created) == current_year
        ).scalar() or 0
        
        monthly_expenses = db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.transaction_type == 'expense',
            extract('month', Transaction.date_created) == current_month,
            extract('year', Transaction.date_created) == current_year
        ).scalar() or 0
        
        return {
            'income': monthly_income,
            'expenses': monthly_expenses,
            'net': monthly_income - monthly_expenses
        }
    
    @staticmethod
    def get_category_breakdown(transaction_type='expense'):
        """Get spending breakdown by category"""
        from sqlalchemy import extract
        
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        categories = db.session.query(
            Transaction.category,
            func.sum(Transaction.amount).label('total')
        ).filter(
            Transaction.transaction_type == transaction_type,
            extract('month', Transaction.date_created) == current_month,
            extract('year', Transaction.date_created) == current_year
        ).group_by(Transaction.category).all()
        
        return [{'category': cat.category, 'amount': cat.total} for cat in categories]


class Alert(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    alert_type = db.Column(db.String(20), nullable=False)  # 'warning', 'caution', 'info'
    message = db.Column(db.String(500), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    date_created = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Alert {self.alert_type}: {self.message}>'
