import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: parseInt(this.configService.get<string>('SMTP_PORT') || '587'),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASSWORD'),
      },
    });
  }

  async sendVerificationCode(email: string, code: string, language: string = 'ru'): Promise<void> {
    const from = this.configService.get<string>('SMTP_FROM');

    await this.transporter.sendMail({
      from,
      to: email,
      subject: 'Prometric - Verify your email',
      html: `
        <!DOCTYPE html>
        <html lang="${language}">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Prometric - Email Verification</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">

          <!-- Main Container -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; min-height: 100vh;">
            <tr>
              <td align="center" style="padding: 60px 20px;">

                <!-- Content Container -->
                <div style="max-width: 600px; width: 100%; text-align: center;">

                  <!-- Logo -->
                  <div style="margin-bottom: 40px;">
                    <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                      <img src="${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'}/logo-light.svg"
                           alt="Prometric Logo"
                           style="height: 40px; width: auto;" />
                    </div>
                    <p style="color: rgb(100, 116, 139); font-size: 14px; margin: 0; font-weight: 500;">AI Business Intelligence Platform</p>
                  </div>

                  <!-- Main Content -->
                  <div style="margin-bottom: 50px;">
                    <h2 style="color: #1a1a1a; font-size: 24px; font-weight: 600; margin: 0 0 20px 0;">Verify your Email</h2>

                    <p style="color: #666666; font-size: 16px; line-height: 1.5; margin: 0 0 40px 0; max-width: 400px; margin-left: auto; margin-right: auto;">
                      Click the button below to verify your email address. If you didn't ask to verify this email address, you can ignore this email.
                    </p>

                    <!-- Verification Code Display -->
                    <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; margin: 30px auto; max-width: 400px;">
                      <p style="color: #666666; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Your Verification Code</p>
                      <div style="font-size: 32px; font-weight: 900; color: #1a1a1a; letter-spacing: 6px; font-family: 'Courier New', monospace;">
                        ${code}
                      </div>
                    </div>

                    <!-- Verify Button -->
                    <a href="#" style="display: inline-block; background: rgb(99, 102, 241); color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); transition: all 0.2s ease;">
                      Verify email →
                    </a>

                    <p style="color: #999999; font-size: 14px; margin: 30px 0 0 0;">
                      Visit our <a href="https://prometric.ai/help" style="color: #1a1a1a; text-decoration: underline;">help center</a> to learn more about our platform and to share your feedback.
                    </p>
                  </div>

                  <!-- Footer -->
                  <div style="margin-top: 60px;">
                    <p style="color: #666666; font-size: 14px; margin: 0 0 8px 0;">Best,</p>
                    <p style="color: #1a1a1a; font-size: 14px; margin: 0 0 30px 0; font-weight: 600;">Prometric</p>

                    <!-- Social Icons -->
                    <div style="margin: 30px 0;">
                      <a href="https://x.com/prometric_ai" style="display: inline-block; margin: 0 8px; text-decoration: none;">
                        <div style="width: 40px; height: 40px; background: #000000; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;">
                          <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                          </svg>
                        </div>
                      </a>
                      <a href="https://instagram.com/prometric.ai" style="display: inline-block; margin: 0 8px; text-decoration: none;">
                        <div style="width: 40px; height: 40px; background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;">
                          <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                          </svg>
                        </div>
                      </a>
                      <a href="https://linkedin.com/company/prometric-ai" style="display: inline-block; margin: 0 8px; text-decoration: none;">
                        <div style="width: 40px; height: 40px; background: #0077b5; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;">
                          <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                          </svg>
                        </div>
                      </a>
                      <a href="https://t.me/prometric_ai" style="display: inline-block; margin: 0 8px; text-decoration: none;">
                        <div style="width: 40px; height: 40px; background: #0088cc; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;">
                          <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
                            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                          </svg>
                        </div>
                      </a>
                    </div>

                    <!-- Company Info -->
                    <div style="margin-top: 40px; padding-top: 30px;">
                      <p style="color: #999999; font-size: 12px; margin: 0; line-height: 1.4;">
                        © 2025 Prometric Inc.<br>
                        Almaty, Kazakhstan | Building the future of business intelligence
                      </p>
                      <p style="color: #999999; font-size: 12px; margin: 10px 0 0 0;">
                        <a href="https://prometric.ai/help" style="color: #999999; text-decoration: underline;">Help Center</a> •
                        <a href="https://prometric.ai/privacy" style="color: #999999; text-decoration: underline;">Privacy Policy</a>
                      </p>
                    </div>
                  </div>

                </div>

                <!-- Decorative Waves Background -->
                <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 200px; overflow: hidden; z-index: -1;">
                  <svg width="100%" height="200" viewBox="0 0 1200 200" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="wave1" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style="stop-color:rgb(99, 102, 241);stop-opacity:0.15" />
                        <stop offset="50%" style="stop-color:rgb(139, 92, 246);stop-opacity:0.2" />
                        <stop offset="100%" style="stop-color:rgb(168, 85, 247);stop-opacity:0.15" />
                      </linearGradient>
                      <linearGradient id="wave2" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style="stop-color:rgb(99, 102, 241);stop-opacity:0.25" />
                        <stop offset="100%" style="stop-color:rgb(139, 92, 246);stop-opacity:0.3" />
                      </linearGradient>
                    </defs>
                    <path d="M0,120 C300,80 600,160 900,120 C1050,100 1200,140 1200,140 L1200,200 L0,200 Z" fill="url(#wave1)"/>
                    <path d="M0,160 C400,120 800,180 1200,160 L1200,200 L0,200 Z" fill="url(#wave2)"/>
                  </svg>
                </div>

              </td>
            </tr>
          </table>

        </body>
        </html>
      `,
    });
  }

  generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}