FROM node:12-stretch-slim

COPY . /usr/src/app
WORKDIR /usr/src/app
RUN npm ci

EXPOSE 1428
CMD node index.js
