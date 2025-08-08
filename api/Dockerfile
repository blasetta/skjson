# Use an official Node.js runtime as a parent image.
# Using a specific version like '20-slim' is a good practice for smaller,
# more secure images.
FROM node:20-slim

# Set the working directory inside the container.
WORKDIR /usr/src/app

# Copy package.json and package-lock.json. This is done in a separate step
# to leverage Docker's layer caching. If these files don't change,
# Docker won't need to re-run `npm install` in subsequent builds.
COPY package*.json ./

# Install app dependencies. 'npm ci' is recommended for production as it's
# faster and safer, installing dependencies directly from package-lock.json.
RUN npm ci --only=production

# Copy the rest of your application's source code into the container.
COPY . .

# Your app listens on port 8080 (defined by process.env.PORT || 8080).
# Expose this port so Cloud Run can send requests to it.
EXPOSE 8080

# Define the command to run your application when the container starts.
CMD [ "npm", "start" ]