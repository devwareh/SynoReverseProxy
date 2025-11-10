#!/bin/sh
set -e

# Default port if not set
export NGINX_PORT=${NGINX_PORT:-8889}

# Replace port in nginx config template
envsubst '$$NGINX_PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g "daemon off;"

