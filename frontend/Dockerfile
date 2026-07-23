FROM node:22

WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation des dépendances
RUN npm install

# Copie du reste du code source
COPY . .

# Exposition du port Vite (par défaut 5173, mais on mappe sur 3001)
EXPOSE 5173

# Lancement du serveur de développement Vite
CMD ["npm", "run", "start"]
