# Usar imagem oficial do Node.js
FROM node:22-alpine

# Definir diretório de trabalho
WORKDIR /app

# Copiar package.json e instalar dependências
COPY package.json package-lock.json ./
RUN npm install

# Copiar o restante do código
COPY . .

# Expor a porta de desenvolvimento do Vite
EXPOSE 5173

# Comando para iniciar o servidor de desenvolvimento
# Executa npm install antes para garantir que dependências novas sejam instaladas
# mesmo se o volume node_modules antigo persistir.
CMD ["sh", "-c", "npm install && npm run dev -- --host"]
