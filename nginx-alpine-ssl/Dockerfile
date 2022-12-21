FROM alpine
RUN apk add nginx
RUN mkdir -p /run/nginx
ADD default.conf /etc/nginx/http.d/default.conf
ADD *.key /etc/ssl/private/
ADD *.crt /etc/ssl/certs/
WORKDIR /var/www/localhost/htdocs
COPY entrypoint.sh /usr/local/bin
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/bin/sh", "/usr/local/bin/entrypoint.sh"]
#EXPOSE 80
EXPOSE 443
CMD ["/bin/sh", "-c", "nginx -g 'daemon off;'; nginx -s reload;"]
