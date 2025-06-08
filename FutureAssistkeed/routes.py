from flask import render_template, request, redirect, url_for, flash, jsonify
from app import app, db
from models import Transaction, Alert
from forms import TransactionForm
from financial_calculator import FinancialCalculator
from datetime import datetime

@app.route('/')
def dashboard():
    """Main dashboard view"""
    # Get financial summary data
    current_balance = Transaction.get_current_balance()
    monthly_summary = Transaction.get_monthly_summary()
    recent_transactions = Transaction.query.order_by(Transaction.date_created.desc()).limit(5).all()
    
    # Generate alerts
    alerts = FinancialCalculator.generate_alerts()
    
    # Get forecast data
    forecast = FinancialCalculator.forecast_balance()
    
    return render_template('dashboard.html',
                         current_balance=current_balance,
                         monthly_summary=monthly_summary,
                         recent_transactions=recent_transactions,
                         alerts=alerts,
                         forecast=forecast)

@app.route('/add_transaction', methods=['GET', 'POST'])
def add_transaction():
    """Add new income or expense transaction"""
    form = TransactionForm()
    
    if form.validate_on_submit():
        transaction = Transaction(
            description=form.description.data,
            amount=form.amount.data,
            transaction_type=form.transaction_type.data,
            category=form.category.data
        )
        
        try:
            db.session.add(transaction)
            db.session.commit()
            
            flash_message = f'{"Income" if form.transaction_type.data == "income" else "Expense"} of P{form.amount.data:.2f} added successfully!'
            flash(flash_message, 'success')
            
            return redirect(url_for('dashboard'))
            
        except Exception as e:
            db.session.rollback()
            flash('Error adding transaction. Please try again.', 'error')
            app.logger.error(f'Error adding transaction: {str(e)}')
    
    return render_template('add_transaction.html', form=form)

@app.route('/transactions')
def transactions():
    """View all transactions with filtering"""
    page = request.args.get('page', 1, type=int)
    transaction_type = request.args.get('type', 'all')
    category = request.args.get('category', 'all')
    
    # Build query
    query = Transaction.query
    
    if transaction_type != 'all':
        query = query.filter(Transaction.transaction_type == transaction_type)
    
    if category != 'all':
        query = query.filter(Transaction.category == category)
    
    # Paginate results
    transactions = query.order_by(Transaction.date_created.desc()).paginate(
        page=page, per_page=20, error_out=False
    )
    
    # Get unique categories for filter dropdown
    categories = db.session.query(Transaction.category).distinct().all()
    category_list = [cat[0] for cat in categories]
    
    return render_template('transactions.html',
                         transactions=transactions,
                         categories=category_list,
                         current_type=transaction_type,
                         current_category=category)

@app.route('/forecast')
def forecast():
    """Detailed 30-day forecast view"""
    forecast_data = FinancialCalculator.forecast_balance()
    return render_template('forecast.html', forecast=forecast_data)

@app.route('/api/chart_data')
def chart_data():
    """API endpoint for chart data"""
    try:
        data = FinancialCalculator.get_chart_data()
        return jsonify(data)
    except Exception as e:
        app.logger.error(f'Error getting chart data: {str(e)}')
        return jsonify({'error': 'Unable to load chart data'}), 500

@app.route('/delete_transaction/<int:transaction_id>', methods=['POST'])
def delete_transaction(transaction_id):
    """Delete a transaction"""
    transaction = Transaction.query.get_or_404(transaction_id)
    
    try:
        db.session.delete(transaction)
        db.session.commit()
        flash('Transaction deleted successfully!', 'success')
    except Exception as e:
        db.session.rollback()
        flash('Error deleting transaction. Please try again.', 'error')
        app.logger.error(f'Error deleting transaction: {str(e)}')
    
    return redirect(url_for('transactions'))

@app.errorhandler(404)
def not_found(error):
    return render_template('base.html', error_message='Page not found'), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return render_template('base.html', error_message='Internal server error'), 500
