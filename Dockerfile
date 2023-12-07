FROM node:16-alpine

# Create volume for persistent data
VOLUME /app/.data

# Create app directory
WORKDIR /app

# Install deps
COPY package.json ./
COPY package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy source
COPY . .

# Env Vars
ENV PORT=3000
ENV DOMAIN=""
ENV USER_NAME=""
ENV PASS=""

# Expose port
EXPOSE $PORT

# Start program
CMD [ "npm", "start" ]
