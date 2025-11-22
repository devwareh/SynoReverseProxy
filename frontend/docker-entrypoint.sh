#!/bin/sh
set -e

# Default ports if not set
export NGINX_PORT=${NGINX_PORT:-8889}
export BACKEND_PORT=${BACKEND_PORT:-18888}

# Replace variables in nginx config template
envsubst '$$NGINX_PORT $$BACKEND_PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g "daemon off;"

