from flask_wtf import FlaskForm
from wtforms import StringField, FloatField, SelectField, TextAreaField
from wtforms.validators import DataRequired, NumberRange, Length

class TransactionForm(FlaskForm):
    description = StringField('Description', validators=[
        DataRequired(message='Description is required'),
        Length(min=1, max=200, message='Description must be between 1 and 200 characters')
    ])
    
    amount = FloatField('Amount', validators=[
        DataRequired(message='Amount is required'),
        NumberRange(min=0.01, message='Amount must be greater than 0')
    ])
    
    transaction_type = SelectField('Type', choices=[
        ('income', 'Income'),
        ('expense', 'Expense')
    ], validators=[DataRequired()])
    
    category = SelectField('Category', choices=[
        # Income categories
        ('salary', 'Salary'),
        ('freelance', 'Freelance'),
        ('investment', 'Investment'),
        ('gift', 'Gift'),
        ('other_income', 'Other Income'),
        # Expense categories
        ('food', 'Food & Dining'),
        ('transportation', 'Transportation'),
        ('housing', 'Housing'),
        ('utilities', 'Utilities'),
        ('healthcare', 'Healthcare'),
        ('entertainment', 'Entertainment'),
        ('shopping', 'Shopping'),
        ('education', 'Education'),
        ('insurance', 'Insurance'),
        ('savings', 'Savings'),
        ('other_expense', 'Other Expense')
    ], validators=[DataRequired()])
