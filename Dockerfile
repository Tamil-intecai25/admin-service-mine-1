FROM node:16.13.0-stretch-slim

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app/
RUN npm install

# Bundle app source
COPY . /usr/src/app

EXPOSE 8086
CMD ["sh", "-c", "NODE_ENV=${APP_ENV} node index.js"]