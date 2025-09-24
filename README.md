# 🚀 PROMETRIC V2 BACKEND

**Enterprise-Grade CRM Backend** с AI Integration и Advanced Security

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white" alt="OpenAI" />
</p>

## 🎯 СИСТЕМА НА ВСЕ 100%

**Production Ready Enterprise CRM** с полной функциональностью:
- ✅ **Authentication & Security**: JWT, XSS protection, rate limiting
- ✅ **Customer Management**: Complete CRM с pipeline
- ✅ **AI Assistant**: Real OpenAI integration с Kazakhstan localization
- ✅ **Analytics**: Business intelligence dashboard
- ✅ **DDD Architecture**: Domain-driven design с CQRS
- ✅ **Multi-tenant**: Organization isolation
- ✅ **Performance**: Optimized для production

## ⚡ Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Configure DATABASE_URL, JWT_SECRET, OPENAI_API_KEY

# Run database migrations
npm run migration:run

# Start development server
npm run start:dev
```

## 🏗️ Architecture Overview

```
📁 src/
├── 🔐 auth/           # Authentication & Authorization
├── 👥 domains/        # DDD Business Domains
│   ├── customer-relationship-management/
│   └── sales-pipeline-management/
├── 🤖 ai/            # AI Assistant Integration
├── 📊 controllers/   # API Controllers
├── 🛠️ services/      # Business Services
├── 🗄️ entities/      # Database Entities
└── 🔧 shared/        # Shared Infrastructure
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Run comprehensive API tests
./test-scripts/comprehensive-api-test.sh

# Run stress tests
python3 test-scripts/stress-test.py
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
