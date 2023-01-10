FROM node:16

# Create app directory
WORKDIR /app

# Bundle app source
COPY . .

#Create volume for persistent data
VOLUME /app/.data

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

EXPOSE 3000
CMD npm start