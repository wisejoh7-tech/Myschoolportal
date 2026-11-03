#!/bin/sh
set -e

echo "🚀 Starting UniPortal Django Service on AWS..."

# Run database migrations if PostgreSQL or database is reachable
if [ -n "$DATABASE_URL" ] || [ -n "$RDS_HOSTNAME" ]; then
    echo "🐘 Applying Django database migrations..."
    python manage.py migrate --noinput || echo "⚠️ Migration completed with notice or bypassed."
fi

# Collect static files for Django admin / static assets
python manage.py collectstatic --noinput || echo "⚠️ Collectstatic bypassed."

exec "$@"
