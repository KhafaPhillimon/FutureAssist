"""
Sample data script to populate the financial tracker with realistic BWP transactions
This will demonstrate the shortfall detection system
"""

from datetime import datetime, timedelta
from app import app, db
from models import Transaction
import random

def create_sample_transactions():
    """Create sample transactions that will trigger shortfall detection"""
    
    with app.app_context():
        # Clear existing transactions
        Transaction.query.delete()
        
        # Starting from 45 days ago to build historical data
        start_date = datetime.now() - timedelta(days=45)
        
        # Sample transaction patterns for Botswana
        income_sources = [
            ('Salary - Government Job', 8500.00, 'salary'),
            ('Freelance Web Design', 1200.00, 'freelance'),
            ('Side Business - Crafts', 800.00, 'other_income'),
        ]
        
        expense_categories = [
            ('Groceries - Choppies', 150.00, 300.00, 'food'),
            ('Transport - Combis', 80.00, 150.00, 'transportation'),
            ('Rent - 2BR Flat', 2200.00, 2200.00, 'housing'),
            ('Electricity - BPC', 180.00, 280.00, 'utilities'),
            ('Water Bill', 120.00, 180.00, 'utilities'),
            ('Internet - Orange', 299.00, 299.00, 'utilities'),
            ('Fuel - Shell/Engen', 200.00, 400.00, 'transportation'),
            ('Medical - Consultation', 150.00, 500.00, 'healthcare'),
            ('Entertainment - Movies', 80.00, 200.00, 'entertainment'),
            ('Clothing - Game/Woolworths', 200.00, 800.00, 'shopping'),
            ('Phone Airtime', 50.00, 100.00, 'utilities'),
            ('Restaurant - Nandos/Steers', 120.00, 250.00, 'food'),
        ]
        
        current_date = start_date
        
        # Create historical transactions (45 days)
        while current_date <= datetime.now():
            
            # Add income (salary typically monthly, freelance irregular)
            if current_date.day == 25:  # Salary day
                transaction = Transaction(
                    description=income_sources[0][0],
                    amount=income_sources[0][1],
                    transaction_type='income',
                    category=income_sources[0][2],
                    date_created=current_date
                )
                db.session.add(transaction)
            
            # Freelance income (random)
            if random.random() < 0.1:  # 10% chance per day
                source = random.choice(income_sources[1:])
                transaction = Transaction(
                    description=source[0],
                    amount=random.uniform(source[1] * 0.5, source[1] * 1.5),
                    transaction_type='income',
                    category=source[2],
                    date_created=current_date
                )
                db.session.add(transaction)
            
            # Add daily expenses (more frequent in recent days)
            expense_probability = 0.7 if current_date >= datetime.now() - timedelta(days=15) else 0.4
            
            if random.random() < expense_probability:
                # 1-3 expenses per day
                num_expenses = random.randint(1, 3)
                for _ in range(num_expenses):
                    expense = random.choice(expense_categories)
                    amount = random.uniform(expense[1], expense[2])
                    
                    transaction = Transaction(
                        description=expense[0],
                        amount=amount,
                        transaction_type='expense',
                        category=expense[3],
                        date_created=current_date + timedelta(hours=random.randint(8, 20))
                    )
                    db.session.add(transaction)
            
            current_date += timedelta(days=1)
        
        # Add some large recent expenses to trigger shortfall
        recent_large_expenses = [
            ('Car Repair - Brake Service', 1500.00, 'transportation'),
            ('Medical Emergency', 2200.00, 'healthcare'),
            ('Laptop Replacement', 4500.00, 'shopping'),
            ('Insurance Premium', 1800.00, 'insurance'),
        ]
        
        for i, expense in enumerate(recent_large_expenses):
            transaction = Transaction(
                description=expense[0],
                amount=expense[1],
                transaction_type='expense',
                category=expense[2],
                date_created=datetime.now() - timedelta(days=i+1)
            )
            db.session.add(transaction)
        
        # Commit all transactions
        db.session.commit()
        
        print(f"Created sample transactions with BWP currency")
        print(f"Current balance: P{Transaction.get_current_balance():.2f}")
        print("Sample data includes recent large expenses to demonstrate shortfall detection")

if __name__ == '__main__':
    create_sample_transactions()