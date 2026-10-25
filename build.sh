#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

python manage.py collectstatic --no-input
python manage.py migrate

# 1. தானாகவே Products டேட்டாவை ஏற்றுவதற்கு:
python manage.py shell -c "from store.seed_data import populate; populate()"

# 2. தானாகவே Admin User உருவாக்குவதற்கு (Username: admin, Password: adminpassword123):
python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.filter(username='admin').exists() or User.objects.create_superuser('admin', 'admin@example.com', 'adminpassword123')"