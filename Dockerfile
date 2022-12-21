FROM node:16
ENV LANG C.UTF-8
ENV LC_ALL C.UTF-8
# use changes to package.json to force Docker not to use the cache
# when we change our application's nodejs dependencies:
RUN mkdir -p /build
COPY package.json /tmp/package.json
RUN cd /tmp && npm install
RUN cp -a /tmp/node_modules /build
COPY . /build
WORKDIR /build

ENV DOMAIN=localhost
ENV USERNAME=testuser
ENV PASS=mypassword

EXPOSE 3000
CMD node index.js
