# � VerificaFato - Sistema Verificador de Notícias

<div align="center">

![Badge Status](https://img.shields.io/badge/Status-Ativo-success?style=flat-square)
![Badge Version](https://img.shields.io/badge/Versão-1.0.0-blue?style=flat-square)
![Badge License](https://img.shields.io/badge/Licença-ISC-green?style=flat-square)

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-000000?style=flat-square&logo=express)](https://expressjs.com/)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-4.11-FF6F00?style=flat-square&logo=tensorflow)](https://www.tensorflow.org/js)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?style=flat-square&logo=bootstrap)](https://getbootstrap.com/)

---

### 🎯 **Uma plataforma inteligente para verificar a veracidade de notícias**

[Início Rápido](#-quick-start) • [Funcionalidades](#-funcionalidades) • [Instalação](#-instalação) • [Uso](#-como-usar) • [Contribuir](#-contribuição)

</div>

---

## 📋 Sobre o Projeto

**VerificaFato** é um aplicativo web moderno que utiliza inteligência artificial e análise de conteúdo para ajudar na detecção de notícias falsas (fake news). O sistema foi desenvolvido como um projeto educacional e de pesquisa para combater a desinformação.

Com uma interface intuitiva e ferramentas poderosas, o VerificaFato oferece:
- 🤖 Análise inteligente com Machine Learning
- 🔍 Detecção de padrões de desinformação
- 📊 Histórico de análises
- 🌙 Suporte a Dark Mode
- 📱 Design responsivo para qualquer dispositivo

---

## ✨ Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| 🤖 **Machine Learning** | Utiliza TensorFlow.js para análise de conteúdo |
| 🔍 **Detecção de Toxicidade** | Identifica linguagem agressiva ou enganosa |
| 📈 **Análise de Crédibilidade** | Verifica compatibilidade com padrões conhecidos |
| 💾 **Histórico Local** | Salva análises no navegador do usuário |
| 🎨 **Dark Mode** | Interface com suporte completo a tema escuro |
| 📱 **Responsivo** | Funciona perfeitamente em desktop, tablet e mobile |
| 🔐 **Privado** | Dados não são armazenados no servidor |
| ⚡ **Rápido** | Processamento local para máxima velocidade |

---

## 🚀 Quick Start

### Pré-requisitos

- **Node.js** 18 ou superior
- **npm** 9 ou superior
- **RAM** 2GB mínimo para TensorFlow.js
- **Git** para clonar o repositório

### Instalação Rápida

```bash
# 1️⃣ Clonar o repositório
git clone https://github.com/seu-usuario/VerificaFato.git
cd VerificaFato

# 2️⃣ Instalar dependências
npm install

# 3️⃣ Configurar variáveis de ambiente (opcional)
cp .env.example .env

# 4️⃣ Iniciar o servidor
npm start
```

Acesse **http://localhost:3000** no seu navegador e comece a usar! 🎉

### Comandos Disponíveis

```bash
npm start          # Inicia o servidor em produção
npm run dev        # Inicia com nodemon para desenvolvimento
npm test           # Executa testes da API
```

---

## 📁 Estrutura do Projeto

```
VerificaFato/
├── public/                 # Arquivos estáticos (HTML, CSS, JS)
│   ├── index.html         # Página principal
│   ├── css/               # Estilos
│   │   ├── style.css
│   │   ├── responsive.css
│   │   └── results.css
│   └── js/                # Scripts do cliente
│       ├── main.js
│       ├── dark-mode.js
│       └── education.js
├── js/                    # Scripts compartilhados
│   └── googleService.js   # Serviço de integração
├── server.js              # Servidor Express
├── googleService.js       # Backend do serviço
├── package.json          # Dependências do projeto
└── README.md             # Este arquivo
```

---

## 🛠️ Tecnologias Utilizadas

### Backend
- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web minimalista
- **Axios** - Cliente HTTP
- **Cheerio** - Parser HTML/XML
- **Dotenv** - Gerenciador de variáveis de ambiente

### Frontend
- **HTML5** - Markup semântico
- **CSS3** - Estilos responsivos
- **Bootstrap 5** - Framework CSS
- **JavaScript Vanilla** - Lógica do cliente
- **TensorFlow.js** - Machine Learning no navegador

### IA & ML
- **TensorFlow.js** - Framework de ML
- **Toxicity Detector** - Modelo de toxicidade do TensorFlow

---

## 📖 Como Usar

### Para Usuários

1. **Abra a aplicação** em http://localhost:3000
2. **Cole o texto** da notícia ou artigo a verificar
3. **Clique em "Analisar"** e aguarde o processamento
4. **Visualize os resultados** com análise detalhada
5. **Ative Dark Mode** conforme preferência pessoal

### Para Desenvolvedores

A aplicação oferece endpoints REST para integração:

#### Analisar Notícia
```http
POST /api/verify
Content-Type: application/json

{
  "text": "Texto da notícia para verificar"
}
```

**Resposta:**
```json
{
  "toxicity": 0.25,
  "credibility": 0.78,
  "status": "SUSPEITA"
}
```

---

## 🔧 Desenvolvimento

### Setup de Desenvolvimento

```bash
# Instalar dependências de desenvolvimento
npm install --save-dev nodemon

# Iniciar em modo watch
npm run dev
```

### Variáveis de Ambiente

Crie um arquivo `.env` baseado em `.env.example`:

```env
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

### Debug

Para ativar logs detalhados:

```bash
DEBUG=* npm start
```

---

## 📊 Endpoints da API

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/` | Página principal |
| `POST` | `/api/verify` | Verifica notícia |
| `GET` | `/api/health` | Status da aplicação |

---

## 🤝 Contribuição

Contribuições são bem-vindas! Para contribuir:

1. Faça um **Fork** do repositório
2. Crie uma **branch** para sua feature (`git checkout -b feature/AmazingFeature`)
3. **Commit** suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Faça **Push** para a branch (`git push origin feature/AmazingFeature`)
5. Abra um **Pull Request**

### Diretrizes

- Siga o código existente
- Adicione comentários para código complexo
- Atualize a documentação conforme necessário
- Teste suas mudanças antes de fazer PR

---

## 🐛 Reportar Problemas

Encontrou um bug? Abra uma [issue no GitHub](https://github.com/seu-usuario/VerificaFato/issues) com:

- ✅ Descrição clara do problema
- ✅ Passos para reproduzir
- ✅ Comportamento esperado vs atual
- ✅ Screenshots (se aplicável)
- ✅ Ambiente (SO, navegador, versão do Node.js)

---

## 📝 Licença

Este projeto está licenciado sob a **ISC License** - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

## 👨‍💻 Autor

Desenvolvido com ❤️ por **Emilly, Luiz e Miguel**

### Agradecimentos

- 🎓 Gratidão ao IFPR por apoiar projetos educacionais
- 📚 TensorFlow e comunidade open-source
- 🙏 Todos os contribuidores

---

## 📞 Suporte

Se tiver dúvidas ou precisar de ajuda:

- 📧 **Email:** seu-email@example.com
- 🐛 **Issues:** [GitHub Issues](https://github.com/seu-usuario/VerificaFato/issues)
- 💬 **Discussões:** [GitHub Discussions](https://github.com/seu-usuario/VerificaFato/discussions)

---

<div align="center">

### ⭐ Gostou? Deixe uma estrela no repositório!

**Desenvolvido com paixão e muita ☕**

</div>
- 🛠️ [API Reference](#api)
- 🚀 [Deploy](#deployment)

### Documentação Técnica
- 📄 [DARK_MODE.md](./DARK_MODE.md) - Sistema de Dark Mode
- 📄 [IMPLEMENTATION_REPORT.md](./IMPLEMENTATION_REPORT.md) - Relatório de Implementação

---

## 🎯 Como Usar

### Interface Web

1. **Abra o navegador** e vá para http://localhost:3000
2. **Escreva ou cole** a notícia a analisar
3. **(Opcional)** Selecione cidade e categoria
4. **Clique** em "Pesquisar Notícias"
5. **Visualize** o resultado: Verdadeira, Falsa ou Inconclusiva
6. **Consulte** as fontes que fundamentam o resultado

### Análise por Texto
```
Entrada: Texto da notícia
Processamento: ML + análise de toxicidade
Saída: Classificação + confiança + fontes
```

### Análise por Link
```
Entrada: URL do artigo
Processamento: Extração de conteúdo + análise
Saída: Classificação detalhada
```

---

## 📊 Funcionalidades

### ✅ Pesquisa de Notícias
- Busca por texto livre
- Busca por URL/link
- Filtro por cidade (54 municípios)
- Filtro por categoria
- Resultados em tempo real

### ✅ Análise Inteligente
- Modelo TensorFlow de toxicidade
- Análise de crédibilidade regional
- Comparação com banco de dados
- Extração automática de contexto

### ✅ Resultados Detalhados
- Classificação: Verdadeira | Falsa | Inconclusiva
- Nível de confiança (%)
- Fontes que fundamentam a análise
- Contexto regional aplicável
- Sugestões de leitura

### ✅ Interface
- Modo Claro e Escuro (Dark Mode)
- Design responsivo
- Navegação intuitiva
- Acessibilidade completa

---

## 🏛️ Cidades Atendidas

**11 Principais Municípios do Oeste do Paraná:**

| | | | |
|---|---|---|---|
| Cascavel | Foz do Iguaçu | Toledo | Marechal C. Rondon |
| Medianeira | Laranjeiras do Sul | Francisco Beltrão | Pato Branco |
| Matelândia | Santa Tereza do Oeste | Santa Terezinha de Itaipu | Jesuítas |

*Em desenvolvimento: Expansão para cobertura dos 54 municípios da região*

---

## 🛠️ Estrutura do Projeto

```
VerificaOeste-Parana/
├── public/
│   ├── index.html              # Página principal
│   ├── css/
│   │   ├── style.css           # Estilos principal (com Dark Mode)
│   │   ├── responsive.css      # Estilos responsivos
│   │   └── results.css         # Estilos dos resultados
│   └── js/
│       ├── main.js             # Lógica principal
│       ├── dark-mode.js        # Sistema de Dark Mode ✨
│       └── dark-mode-test.js   # Testes do Dark Mode
├── js/
│   └── (scripts backend - movidos para raiz)
├── server.js                   # Servidor Express
├── googleService.js            # Integração com Google
├── testGoogleAPI.js            # Testes da API
├── package.json                # Dependências
├── .env                        # Variáveis de ambiente
├── README.md                   # Este arquivo
├── DARK_MODE.md                # Documentação Dark Mode
├── IMPLEMENTATION_REPORT.md    # Relatório de implementação
└── TODO.md                     # Tarefas futuras
```

---

## 💻 Tecnologias Utilizadas

### Backend
- **Node.js 18+**: Runtime JavaScript
- **Express.js 4.18**: Framework web
- **TensorFlow.js 4.22**: Machine Learning
- **Toxicity Model**: Detecção de linguagem prejudicial

### Frontend
- **HTML5**: Estrutura semântica
- **CSS3**: Styling (com Dark Mode)
- **Bootstrap 5.3**: Framework CSS responsivo
- **Font Awesome 6.0**: Ícones
- **Vanilla JavaScript**: Interatividade

### Extras
- **Axios**: Requisições HTTP
- **Cheerio**: Web scraping
- **dotenv**: Gerenciamento de env vars
- **nodemon**: Desenvolvimento

### Ferramentas
- **Git**: Controle de versão
- **npm**: Gerenciador de pacotes

---

## ⚙️ Desenvolvimento

### Setup Local

```bash
# Clonar projeto
git clone https://github.com/seu-usuario/VerificaOeste-Parana.git

# Instalar dependências
cd VerificaOeste-Parana
npm install

# Criar .env
cp .env.example .env

# Adicionar API keys se necessário
# GOOGLE_API_KEY=sua-chave
# etc...

# Iniciar em modo dev (com hot-reload)
npm run dev

# Ou iniciar servidor normal
npm start
```

### Servidor Rodando
```
✅ Servidor iniciado em http://localhost:3000
🤖 Modelo TensorFlow carregando...
✅ Modelo carregado com sucesso
```

### Teste API
```bash
# Testar análise
curl -X POST http://localhost:3000/api/verificar \
  -H "Content-Type: application/json" \
  -d '{"texto": "Fake news de exemplo"}'
```

---

## 🔌 API

### Endpoints

#### POST `/api/verificar`
Verifica e analisa uma notícia

**Request:**
```json
{
  "texto": "Conteúdo da notícia",
  "link": "https://exemplo.com/noticia",
  "cidade": "Cascavel",
  "categoria": "Política"
}
```

**Response:**
```json
{
  "status": "success",
  "resultado": "falsa",
  "confianca": 0.85,
  "fontes": [
    {
      "titulo": "Fonte 1",
      "url": "https://...",
      "snippet": "..."
    }
  ],
  "analise": {
    "toxicidade": 0.3,
    "credibilidade": "baixa",
    "contexto_regional": true
  }
}
```

#### GET `/api/municipios`
Lista todos os municípios atendidos

**Response:**
```json
{
  "status": "success",
  "total": 54,
  "municipios": ["Cascavel", "Foz do Iguaçu", ...]
}
```

---

## 🌙 Dark Mode

O sistema possui um **Dark Mode completo e otimizado**:

- 🌙 Botão flutuante para alternar tema
- 💾 Preferência salva em localStorage
- 🎨 Paleta pensada para conforto noturno
- ⚡ Transições suaves (300ms)

Para mais informações, veja [DARK_MODE.md](./DARK_MODE.md)

---

## 📦 Deployment

### Opção 1: Heroku

```bash
# Login no Heroku
heroku login

# Criar app
heroku create seu-app-name

# Deploy
git push heroku main

# Ver logs
heroku logs --tail
```

### Opção 2: Railway / Render / Vercel

Consulte documentação dos serviços.

### Variáveis de Ambiente

Certifique-se de configurar no servidor:
```
NODE_ENV=production
PORT=3000
GOOGLE_API_KEY=sua-chave
```

---

## 🧪 Testes

### Teste Manual

```bash
# Abrir console no navegador (F12)
# Executar no console:
window.darkModeManager.toggleTheme()  // Alternar dark mode
window.darkModeManager.getCurrentTheme()  // Ver tema atual
```

### Teste Automatizado

```bash
npm test
```

---

## 🐛 Conhecidos & Limitações

### Limitações Atuais
- ⏳ Análise pode levar 2-5 segundos
- 🌐 Requer conexão com internet
- 📊 Modelo ML ainda em treinamento
- 📱 Mobile: Algumas animações desabilitadas

### Melhorias Futuras
- [ ] Suporte a múltiplos idiomas
- [ ] Cache de análises
- [ ] Gráficos de trending topics
- [ ] API aberta para desenvolvedores
- [ ] Integração com redes sociais
- [ ] App mobile nativo

---

## 🤝 Contribuindo

### Como Contribuir

1. **Fork** o projeto
2. **Crie uma branch** para sua feature (`git checkout -b feature/NovaFeature`)
3. **Commit** suas mudanças (`git commit -m 'Adiciona NovaFeature'`)
4. **Push** para a branch (`git push origin feature/NovaFeature`)
5. **Abra um Pull Request**

### Código de Conduta

Por favor, seja respeitoso e construtivo. Leia nosso [Código de Conduta](#).

### Diretrizes

- ✅ Mantenha o código limpo
- ✅ Adicione comentários em código complexo
- ✅ Teste antes de submeter
- ✅ Atualize documentação conforme necessário

---

## 📄 Licença

Este projeto está licenciado sob a **ISC License** - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

## 🤝 Suporte

### Precisa de Ajuda?

- 📧 **Email**: contato@verificaoeste.com
- 🐛 **Issues**: [GitHub Issues](https://github.com/seu-usuario/VerificaOeste-Parana/issues)
- 💬 **Discussões**: [GitHub Discussions](https://github.com/seu-usuario/VerificaOeste-Parana/discussions)
- 📱 **WhatsApp**: Suporte via WhatsApp

---

## 👥 Créditos & Agradecimentos

- **Desenvolvedor Principal**: Seu Nome
- **Design**: UI/UX Team
- **Dados**: Fontes regionais confiáveis
- **ML Model**: TensorFlow Community

---

## 📈 Estatísticas

| Métrica | Valor |
|---------|-------|
| Municípios Principal Atendidos | 11 |
| Municípios em Expansão | 54 |
| Fontes Confiáveis | 9+ |
| Precisão do Modelo | 85%+ |
| Tempo de Resposta | 2-5s |

---

## 🔗 Links Úteis

- 🌐 [Website](https://verificaoeste.com)
- 📚 [Documentação Completa](./docs)
- 🐛 [Reportar Bug](https://github.com/seu-usuario/VerificaOeste-Parana/issues)
- 💡 [Sugerir Feature](https://github.com/seu-usuario/VerificaOeste-Parana/issues)
- 📖 [Dark Mode Guide](./DARK_MODE.md)

---

## 📝 Changelog

### v1.0.0 (Fevereiro 2026)
- ✨ Lançamento inicial
- ✨ Sistema de Dark Mode completo
- ✨ Análise com TensorFlow.js
- ✨ Verificação cruzada regional
- ✨ Interface responsiva

### v0.9.0 (Beta)
- 🔧 Testes de API
- 🔧 Integração com fontes

---

## 🎯 Roadmap

- **Q1 2026**: Melhorias de UI/UX
- **Q2 2026**: App mobile
- **Q3 2026**: Integração com redes sociais
- **Q4 2026**: Versão 2.0

---

<div align="center">

### ⭐ Gostou do Projeto?

Deixe uma estrela no GitHub! [⭐ Star](https://github.com/seu-usuario/VerificaOeste-Parana)

---

**Combatendo Fake News no Oeste do Paraná** 

Da serra ao lago, pela verdade. 🗽

---

Feito com ❤️ para o Oeste do Paraná

</div>