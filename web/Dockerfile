FROM nginx:1.27.3-alpine

# Non-root : nginx doit pouvoir écrire son cache et son pid sans être root.
RUN rm -rf /usr/share/nginx/html/* \
 && sed -i -e '/^user/d' -e 's,/var/run/nginx.pid,/tmp/nginx.pid,' /etc/nginx/nginx.conf \
 && chown -R nginx:nginx /var/cache/nginx

COPY --chown=nginx:nginx index.html style.css game.js script.js /usr/share/nginx/html/

USER nginx
EXPOSE 80
