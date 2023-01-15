FROM node:latest

# Create app directory
WORKDIR /usr/src/app

# Install deps
COPY package.json ./
COPY package-lock.json ./
RUN npm install

# Copy data
COPY . .

# Start program
CMD [ "npm", "start" ]