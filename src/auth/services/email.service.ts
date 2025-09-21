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
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">

          <!-- Main Container -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
            <tr>
              <td align="center">

                <!-- Email Content Container -->
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden;">

                  <!-- Header with Logo -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                      <!-- Logo -->
                      <div style="background: white; width: 80px; height: 80px; border-radius: 20px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#667eea"/>
                        </svg>
                      </div>

                      <h1 style="color: white; font-size: 32px; font-weight: 700; margin: 0 0 8px 0; letter-spacing: -0.5px;">Prometric</h1>
                      <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 0; font-weight: 500;">AI Business Intelligence Platform</p>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="padding: 50px 40px;">

                      <h2 style="color: #1e293b; font-size: 28px; font-weight: 700; margin: 0 0 16px 0; text-align: center;">Verify Your Email</h2>

                      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; text-align: center;">
                        Welcome to Prometric! Please use the verification code below to complete your registration:
                      </p>

                      <!-- Verification Code Box -->
                      <div style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border: 2px dashed #cbd5e1; border-radius: 16px; padding: 30px; text-align: center; margin: 30px 0;">
                        <p style="color: #64748b; font-size: 14px; margin: 0 0 12px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
                        <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                          <span style="font-size: 36px; font-weight: 900; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                            ${code}
                          </span>
                        </div>
                      </div>

                      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 30px 0;">
                        <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 500;">
                          ⏰ This code expires in <strong>10 minutes</strong> for your security.
                        </p>
                      </div>

                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background: #f8fafc; padding: 40px 30px; text-align: center; border-top: 1px solid #e2e8f0;">

                      <!-- Social Icons -->
                      <div style="margin-bottom: 30px;">
                        <p style="color: #64748b; font-size: 14px; margin: 0 0 20px 0; font-weight: 600;">Follow us on social media</p>

                        <div style="display: inline-block;">
                          <!-- LinkedIn -->
                          <a href="https://linkedin.com/company/prometric" style="display: inline-block; margin: 0 8px; text-decoration: none;">
                            <div style="background: #0077b5; width: 40px; height: 40px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;">
                              <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                              </svg>
                            </div>
                          </a>

                          <!-- Instagram -->
                          <a href="https://instagram.com/prometric" style="display: inline-block; margin: 0 8px; text-decoration: none;">
                            <div style="background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%); width: 40px; height: 40px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;">
                              <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                              </svg>
                            </div>
                          </a>

                          <!-- X (Twitter) -->
                          <a href="https://x.com/prometric" style="display: inline-block; margin: 0 8px; text-decoration: none;">
                            <div style="background: #000000; width: 40px; height: 40px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;">
                              <svg width="16" height="16" fill="white" viewBox="0 0 24 24">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                              </svg>
                            </div>
                          </a>
                        </div>
                      </div>

                      <!-- Company Info -->
                      <p style="color: #64748b; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">Best regards,</p>
                      <p style="color: #1e293b; font-size: 16px; margin: 0 0 20px 0; font-weight: 700;">The Prometric Team</p>

                      <div style="border-top: 1px solid #e2e8f0; padding-top: 20px;">
                        <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.5;">
                          © 2025 Prometric AI. All rights reserved.<br>
                          Kazakhstan, Almaty | Building the future of business intelligence
                        </p>
                      </div>

                    </td>
                  </tr>

                </table>

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