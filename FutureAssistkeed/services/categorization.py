import re
from models import TRANSACTION_CATEGORIES


def categorize_transaction(description, amount):
    """
    AI-based transaction categorization using keyword matching
    Optimized for Botswana-specific merchants and categories
    
    Args:
        description (str): Transaction description
        amount (float): Transaction amount (positive for income, negative for expenses)
    
    Returns:
        dict: Category, subcategory, confidence score, and explanation
    """
    description_lower = description.lower().strip()
    
    # Determine if it's income or expense based on amount
    is_income = amount > 0
    categories = TRANSACTION_CATEGORIES['income'] if is_income else TRANSACTION_CATEGORIES['expenses']
    
    best_match = {
        'category': 'other_income' if is_income else 'other_expenses',
        'subcategory': None,
        'confidence': 0.1,
        'explanation': 'Default category assigned - no specific keywords matched'
    }
    
    # Enhanced keyword matching with Botswana-specific terms
    for category, keywords in categories.items():
        for keyword in keywords:
            # Use word boundaries to avoid partial matches
            pattern = r'\b' + re.escape(keyword.lower()) + r'\b'
            if re.search(pattern, description_lower):
                confidence = calculate_confidence(keyword, description_lower, is_income)
                
                if confidence > best_match['confidence']:
                    best_match = {
                        'category': category,
                        'subcategory': get_subcategory(category, description_lower),
                        'confidence': confidence,
                        'explanation': f'Matched keyword "{keyword}" in description'
                    }
    
    # Apply additional rules for better accuracy
    best_match = apply_categorization_rules(description_lower, amount, best_match)
    
    return best_match


def calculate_confidence(keyword, description, is_income):
    """Calculate confidence score based on keyword match quality"""
    base_confidence = 0.6
    
    # Boost confidence for exact matches
    if keyword == description:
        base_confidence += 0.3
    
    # Boost confidence for specific merchant names
    botswana_merchants = [
        'spar', 'choppies', 'pick n pay', 'mascom', 'btc', 'orange',
        'first national bank', 'fnb', 'standard chartered', 'barclays'
    ]
    
    if any(merchant in description for merchant in botswana_merchants):
        base_confidence += 0.2
    
    # Boost confidence for clear transaction types
    clear_indicators = {
        'income': ['salary', 'wage', 'pay', 'allowance', 'grant'],
        'expense': ['purchase', 'payment', 'bill', 'fee']
    }
    
    indicator_type = 'income' if is_income else 'expense'
    if any(indicator in description for indicator in clear_indicators.get(indicator_type, [])):
        base_confidence += 0.15
    
    return min(base_confidence, 0.95)  # Cap at 95%


def get_subcategory(category, description):
    """Get more specific subcategory based on description"""
    subcategory_map = {
        'food': {
            'restaurant': ['restaurant', 'takeaway', 'fast food', 'cafe'],
            'grocery': ['grocery', 'spar', 'choppies', 'pick n pay', 'supermarket'],
            'street_food': ['vendor', 'street', 'market']
        },
        'transport': {
            'taxi': ['taxi', 'combi'],
            'fuel': ['fuel', 'petrol', 'diesel', 'gas'],
            'public': ['bus', 'public transport']
        },
        'communication': {
            'airtime': ['airtime', 'credit', 'recharge'],
            'data': ['data', 'internet', 'wifi'],
            'monthly': ['monthly', 'subscription', 'contract']
        },
        'healthcare': {
            'medication': ['medicine', 'pharmacy', 'drugs'],
            'consultation': ['doctor', 'clinic', 'consultation'],
            'emergency': ['emergency', 'hospital', 'ambulance']
        }
    }
    
    if category in subcategory_map:
        for subcategory, keywords in subcategory_map[category].items():
            if any(keyword in description for keyword in keywords):
                return subcategory
    
    return None


def apply_categorization_rules(description, amount, current_match):
    """Apply additional business rules for better categorization"""
    
    # Rule 1: Large amounts are likely salary/business income
    if amount > 5000 and amount > 0:  # BWP 5000+
        current_match['category'] = 'salary'
        current_match['confidence'] = min(current_match['confidence'] + 0.1, 0.9)
        current_match['explanation'] += ' (Large amount suggests salary/business income)'
    
    # Rule 2: Regular small amounts might be daily expenses
    if 10 <= abs(amount) <= 100:  # BWP 10-100
        if any(word in description for word in ['taxi', 'food', 'lunch', 'breakfast']):
            current_match['confidence'] = min(current_match['confidence'] + 0.05, 0.9)
    
    # Rule 3: Government-related terms
    gov_keywords = ['government', 'ministry', 'council', 'bdf', 'police', 'ipelegeng']
    if any(keyword in description for keyword in gov_keywords):
        if amount > 0:
            current_match['category'] = 'government'
            current_match['confidence'] = min(current_match['confidence'] + 0.2, 0.9)
        current_match['explanation'] += ' (Government-related transaction detected)'
    
    # Rule 4: Educational institutions
    edu_keywords = ['university', 'school', 'college', 'ub', 'botho', 'limkokwing']
    if any(keyword in description for keyword in edu_keywords):
        current_match['category'] = 'education'
        current_match['confidence'] = min(current_match['confidence'] + 0.15, 0.9)
        current_match['explanation'] += ' (Educational institution detected)'
    
    return current_match


def get_categorization_explanation(category, confidence):
    """Generate user-friendly explanation for categorization decision"""
    explanations = {
        'food': 'This transaction appears to be food-related based on keywords like grocery stores or restaurants.',
        'transport': 'This looks like a transportation expense, including taxi, fuel, or public transport.',
        'communication': 'This seems to be a communication expense for airtime, data, or phone services.',
        'salary': 'This appears to be salary or regular income based on the amount and description.',
        'business': 'This looks like business-related income or expense.',
        'healthcare': 'This appears to be a medical or healthcare-related expense.',
        'education': 'This seems to be an education-related expense or fee.',
        'housing': 'This looks like a housing-related expense such as rent or utilities.',
        'entertainment': 'This appears to be an entertainment or leisure expense.'
    }
    
    base_explanation = explanations.get(category, 'Category assigned based on transaction description analysis.')
    
    confidence_text = ""
    if confidence >= 0.8:
        confidence_text = " I'm quite confident about this categorization."
    elif confidence >= 0.6:
        confidence_text = " I'm moderately confident about this categorization."
    else:
        confidence_text = " This categorization has lower confidence - you may want to review it."
    
    return base_explanation + confidence_text
