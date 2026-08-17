# Renovação com Cristo (RCC) - Plataforma

Este é o repositório principal do projeto **Renovação com Cristo (RCC)**, contendo três aplicações distintas divididas em uma arquitetura moderna utilizando **Node.js** e **Next.js**. O sistema foi projetado para gerenciar eventos, membros, inscrições e conteúdo institucional através do Site, Dashboard e uma API central.

## 🛠️ Tecnologias e Linguagens Utilizadas

- **RCC-API**:
  - Node.js com Express
  - TypeScript
  - Prisma (ORM)
  - Banco de Dados: MySQL
- **RCC-Dash (Painel Administrativo)**:
  - Next.js (React)
  - TypeScript
  - Tailwind CSS
- **RCC-Site (Página Institucional)**:
  - Next.js (React)
  - TypeScript
  - Tailwind CSS

## 🔗 URLs do Projeto em Produção

O projeto está rodando em um servidor local via Docker e exposto para a internet através do Nginx Proxy Manager (NPM).

- **Site Institucional**: [https://renovacaocomcristo.com.br](https://renovacaocomcristo.com.br)
- **Painel Administrativo (Dashboard)**: [https://dash.renovacaocomcristo.com.br](https://dash.renovacaocomcristo.com.br)
- **API (Backend)**: [https://api.renovacaocomcristo.com.br](https://api.renovacaocomcristo.com.br)

## 🚀 Como fazer o Deploy (Subir o projeto)

O projeto inteiro está conteinerizado com Docker. Para atualizar ou subir o projeto no servidor pela primeira vez:

1. Acesse o servidor via SSH:
   ```bash
   ssh root@10.0.40.106
   ```
2. Navegue até a pasta do projeto:
   ```bash
   cd /root/Site_Luis
   ```
3. Execute o comando do Docker Compose para construir e subir todas as imagens:
   ```bash
   docker compose up --build -d
   ```

Isso criará a rede `rcc-network` e fará o deploy automático do `rcc-api` (porta 3333), `rcc-dash` (porta 3001) e `rcc-site` (porta 3000). O Nginx Proxy Manager (já configurado) redireciona as URLs públicas para essas portas correspondentes internamente.
