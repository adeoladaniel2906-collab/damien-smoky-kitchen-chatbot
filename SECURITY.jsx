# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are
currently being supported with security updates.
import React from "react";

const SECURITY_EMAIL = "adeoladaniel2906@gmail.com";

const SecurityPolicy = () => {
  const sections = [
    {
      title: "1. Purpose and Scope",
      content: (
        <>
          <p>
            Damien's Smoky Kitchen is committed to protecting the
            confidentiality, integrity, and availability of its website,
            chatbot, applications, infrastructure, and customer information.
          </p>
          <p>
            This policy establishes mandatory security rules for all visitors,
            customers, developers, contractors, and other individuals
            interacting with our digital services.
          </p>
          <p>
            Access to our services does not grant permission to test,
            investigate, access, modify, or compromise systems beyond the
            functionality expressly made available to you.
          </p>
        </>
      ),
    },
    {
      title: "2. Strict No-Hacking Policy",
      content: (
        <>
          <p>
            <strong>
              Unauthorized hacking, system intrusion, and security abuse are
              strictly prohibited.
            </strong>
          </p>
          <p>You must not:</p>
          <ul>
            <li>
              Attempt to gain unauthorized access to accounts, servers,
              databases, administrative panels, APIs, or restricted resources.
            </li>
            <li>
              Bypass authentication, authorization, access controls, security
              restrictions, or administrative safeguards.
            </li>
            <li>
              Exploit vulnerabilities to obtain unauthorized access,
              privileges, information, or control.
            </li>
            <li>
              Steal, intercept, guess, expose, or misuse passwords, API keys,
              session cookies, authentication tokens, or other credentials.
            </li>
            <li>
              Access, collect, disclose, or manipulate another person's
              private information, messages, orders, or account data.
            </li>
            <li>
              Upload or deploy malware, ransomware, spyware, backdoors,
              malicious scripts, or unauthorized executable code.
            </li>
            <li>
              Attempt SQL injection, cross-site scripting, server-side
              request forgery, or other attacks against our live systems
              without explicit written authorization.
            </li>
            <li>
              Conduct unauthorized penetration testing, vulnerability
              scanning, automated exploitation, or security assessments.
            </li>
            <li>
              Perform denial-of-service attacks, flood our services, overload
              our infrastructure, or intentionally disrupt availability.
            </li>
            <li>
              Scrape restricted information, exfiltrate data, or circumvent
              technical controls designed to protect our services.
            </li>
            <li>
              Impersonate customers, employees, administrators, security
              researchers, or other individuals.
            </li>
            <li>
              Interfere with our chatbot, manipulate its integrations, or
              attempt to use it to gain unauthorized access to connected
              services or confidential information.
            </li>
            <li>
              Circumvent suspensions, rate limits, security controls, or
              restrictions imposed to protect our systems.
            </li>
          </ul>
          <p>
            Good intentions, curiosity, technical expertise, or the discovery
            of a vulnerability do not independently authorize exploitation.
          </p>
        </>
      ),
    },
    {
      title: "3. Unauthorized Data Access and Disclosure",
      content: (
        <>
          <p>
            Accessing, copying, downloading, retaining, publishing, selling,
            or disclosing information without authorization is prohibited.
          </p>
          <p>
            You must not attempt to obtain customer records, payment
            information, private conversations, internal documents, source
            code, secrets, or confidential business information through
            unauthorized means.
          </p>
          <p>
            If you accidentally encounter information that you are not
            authorized to access, stop immediately. Do not download additional
            information, investigate further, or share the material publicly.
            Report the incident through our designated security contact.
          </p>
        </>
      ),
    },
    {
      title: "4. Responsible Vulnerability Disclosure",
      content: (
        <>
          <p>
            We encourage good-faith security researchers to report suspected
            vulnerabilities so that we can investigate and address them.
          </p>
          <p>
            Security testing is permitted only when expressly authorized
            in writing and conducted within the approved scope. Submitting
            a vulnerability report does not grant permission to perform
            additional testing or exploitation.
          </p>
          <p>When reporting a suspected vulnerability:</p>
          <ul>
            <li>
              Provide a clear description of the suspected security issue.
            </li>
            <li>
              Identify the affected website, feature, endpoint, or component.
            </li>
            <li>
              Explain the potential impact using evidence obtained lawfully.
            </li>
            <li>
              Include relevant timestamps, error messages, and sanitized
              screenshots when available.
            </li>
            <li>
              Provide safe reproduction instructions that do not require
              accessing another person's information or damaging a system.
            </li>
            <li>
              Avoid including passwords, API keys, authentication tokens,
              payment details, or unnecessary personal information.
            </li>
          </ul>
          <p>
            Do not publicly disclose a suspected vulnerability, its
            exploitation details, or confidential information before
            coordinating with us and allowing a reasonable opportunity
            to investigate and remediate the issue.
          </p>
        </>
      ),
    },
    {
      title: "5. How to Report a Security Vulnerability",
      content: (
        <>
          <p>
            Send suspected security vulnerabilities, security incidents,
            and unauthorized-access concerns to our designated security
            contact.
          </p>
          <p>
            Please use the subject line:
            <strong> Security Vulnerability Report</strong>.
          </p>
          <p>
            Include the affected component, a description of the issue,
            its potential impact, and safe reproduction steps where
            available.
          </p>
          <p>
            Do not send live credentials, sensitive customer records,
            malicious attachments, or unnecessary confidential information.
          </p>
          <p>
            We will review reports as resources permit. A report does not
            guarantee a response within a specific period, a particular
            resolution, compensation, or a security reward.
          </p>
          <p>
            Do not assume that a report has been accepted or that testing
            is authorized unless we explicitly confirm this in writing.
          </p>
        </>
      ),
    },
    {
      title: "6. Prohibited Testing and Research Conduct",
      content: (
        <>
          <p>
            Unless expressly authorized in writing, you must not conduct
            intrusive testing against our production systems.
          </p>
          <p>This includes:</p>
          <ul>
            <li>Testing that accesses or exposes other users' data.</li>
            <li>Brute-force attacks or credential-stuffing attempts.</li>
            <li>Denial-of-service or resource-exhaustion testing.</li>
            <li>Social engineering, phishing, or impersonation.</li>
            <li>Installing persistence mechanisms or backdoors.</li>
            <li>Modifying or deleting production data.</li>
            <li>
              Testing third-party systems without authorization from their
              owners.
            </li>
            <li>
              Using a vulnerability to expand access beyond what is
              necessary for an authorized assessment.
            </li>
          </ul>
          <p>
            If testing begins to expose sensitive information, affect
            availability, or produce unexpected access, stop immediately
            and notify us.
          </p>
        </>
      ),
    },
    {
      title: "7. Enforcement and Consequences",
      content: (
        <>
          <p>
            We reserve the right, subject to applicable law and contractual
            obligations, to take proportionate measures to protect our
            services and users.
          </p>
          <p>Depending on the circumstances, these measures may include:</p>
          <ul>
            <li>Restricting or suspending access to our services.</li>
            <li>Revoking compromised credentials or sessions.</li>
            <li>
              Blocking abusive traffic and implementing additional security
              controls.
            </li>
            <li>
              Preserving relevant security logs and evidence where lawful.
            </li>
            <li>
              Notifying affected users, hosting providers, or relevant
              service providers when appropriate.
            </li>
            <li>
              Reporting suspected unlawful activity to appropriate authorities
              when warranted.
            </li>
            <li>
              Pursuing available legal remedies for unauthorized activity.
            </li>
          </ul>
          <p>
            We will assess suspected violations based on the available
            evidence, the nature of the conduct, the impact on users, and
            applicable law.
          </p>
        </>
      ),
    },
    {
      title: "8. Protection of Accounts and Devices",
      content: (
        <>
          <p>Users are responsible for taking reasonable security measures:</p>
          <ul>
            <li>Use strong, unique passwords and protect your credentials.</li>
            <li>Never share verification codes or authentication tokens.</li>
            <li>
              Access our services through trusted devices and updated
              browsers.
            </li>
            <li>
              Report suspected account compromise or unauthorized activity
              promptly.
            </li>
            <li>
              Do not attempt to bypass security warnings or browser
              protections.
            </li>
          </ul>
        </>
      ),
    },
    {
      title: "9. Third-Party Services",
      content: (
        <>
          <p>
            Our website and chatbot may rely on third-party hosting
            providers, AI services, messaging platforms, payment providers,
            or other external integrations.
          </p>
          <p>
            Those services may have their own security policies and
            vulnerability disclosure procedures. This policy does not
            authorize testing or accessing third-party systems.
          </p>
          <p>
            Security concerns involving a third party should also be
            reported to the relevant service provider when appropriate.
          </p>
        </>
      ),
    },
    {
      title: "10. Privacy and Security Investigations",
      content: (
        <>
          <p>
            Security reports may contain technical information needed to
            investigate and remediate a suspected vulnerability.
          </p>
          <p>
            We will handle submitted information according to applicable
            privacy requirements and our privacy policy. We may share
            relevant information with authorized technical personnel or
            service providers when reasonably necessary to investigate
            and resolve a security issue.
          </p>
          <p>
            Do not include personal information that is unnecessary for
            investigating the reported issue.
          </p>
        </>
      ),
    },
    {
      title: "11. No Guarantee of Security or Rewards",
      content: (
        <>
          <p>
            We work to maintain appropriate security safeguards, but no
            website, application, network, or information system can be
            guaranteed to be completely secure.
          </p>
          <p>
            We do not operate a bug bounty program unless we explicitly
            announce one through an official channel. Reporting a
            vulnerability does not create an entitlement to payment,
            compensation, employment, or public recognition.
          </p>
        </>
      ),
    },
    {
      title: "12. Policy Updates and Contact",
      content: (
        <>
          <p>
            We may update this policy to reflect changes in our systems,
            security practices, services, or applicable legal requirements.
            The latest published version will govern from its stated
            effective date, subject to applicable law.
          </p>
          <p>
            For security-related reports, contact:
            <strong> {SECURITY_EMAIL}</strong>
          </p>
          <p>
            For general customer support or order enquiries, use our
            designated customer support channels rather than the security
            reporting address.
          </p>
        </>
      ),
    },
  ];

  return (
    <main className="security-page">
      <header className="security-hero">
        <div className="security-badge">SECURITY CENTER</div>

        <h1>Security Policy</h1>

        <p>
          Protecting our customers, systems, and information is a
          responsibility we take seriously.
        </p>

        <a
          className="security-report-button"
          href={`mailto:${SECURITY_EMAIL}?subject=${encodeURIComponent(
            "Security Vulnerability Report"
          )}`}
        >
          Report a Vulnerability
        </a>

        <p className="security-warning">
          Unauthorized access, hacking, exploitation, and deliberate
          disruption are strictly prohibited.
        </p>
      </header>

      <div className="security-layout">
        <aside className="security-sidebar">
          <h2>Security Principles</h2>
          <ul>
            <li>Authorized access only</li>
            <li>No unauthorized hacking</li>
            <li>Protect customer information</li>
            <li>Responsible disclosure</li>
            <li>Prompt incident reporting</li>
          </ul>
        </aside>

        <article className="security-content">
          <div className="security-notice">
            <strong>Important Notice</strong>
            <p>
              Discovering a vulnerability does not authorize you to exploit
              it. Stop any unauthorized testing and report the issue through
              the designated security contact.
            </p>
          </div>

          {sections.map((section) => (
            <section className="security-section" key={section.title}>
              <h2>{section.title}</h2>
              {section.content}
            </section>
          ))}

          <section className="security-contact">
            <h2>Report a Security Issue</h2>
            <p>
              Have you discovered a suspected vulnerability? Please report
              it privately and provide enough information for our team to
              investigate safely.
            </p>

            <a
              href={`mailto:${SECURITY_EMAIL}?subject=${encodeURIComponent(
                "Security Vulnerability Report"
              )}`}
            >
              Contact Security Team
            </a>

            <p className="security-contact-email">{SECURITY_EMAIL}</p>
          </section>

          <footer className="security-footer">
            <p>
              Damien's Smoky Kitchen · Security Policy
            </p>
            <p>
              Effective date: [Insert Date] · Last updated: [Insert Date]
            </p>
          </footer>
        </article>
      </div>

      <style>{`
        .security-page {
          --security-ink: #202020;
          --security-muted: #626262;
          --security-border: #e5e5e5;
          --security-accent: #a5261d;
          --security-soft: #fff4f1;
          max-width: 1180px;
          margin: 0 auto;
          padding: 32px 24px 64px;
          color: var(--security-ink);
          font-family: Arial, Helvetica, sans-serif;
          line-height: 1.75;
        }

        .security-hero {
          padding: 48px 32px;
          border-radius: 18px;
          background: #202020;
          color: #fff;
          text-align: center;
        }

        .security-badge {
          display: inline-block;
          padding: 5px 12px;
          border: 1px solid #777;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 2px;
        }

        .security-hero h1 {
          margin: 16px 0 8px;
          font-size: clamp(32px, 5vw, 48px);
          line-height: 1.2;
        }

        .security-hero > p {
          max-width: 650px;
          margin: 12px auto;
          color: #e4e4e4;
        }

        .security-report-button,
        .security-contact a {
          display: inline-block;
          margin-top: 18px;
          padding: 12px 22px;
          border-radius: 8px;
          background: var(--security-accent);
          color: #fff;
          font-weight: 700;
          text-decoration: none;
        }

        .security-report-button:hover,
        .security-contact a:hover {
          background: #7d1a14;
        }

        .security-hero .security-warning {
          margin-top: 24px;
          color: #ffd7d1;
          font-size: 14px;
        }

        .security-layout {
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr);
          gap: 40px;
          margin-top: 36px;
          align-items: start;
        }

        .security-sidebar {
          position: sticky;
          top: 24px;
          padding: 22px;
          border: 1px solid var(--security-border);
          border-radius: 12px;
        }

        .security-sidebar h2 {
          margin-top: 0;
          font-size: 18px;
        }

        .security-sidebar ul {
          padding-left: 20px;
          color: var(--security-muted);
        }

        .security-sidebar li {
          margin-bottom: 8px;
        }

        .security-content {
          min-width: 0;
        }

        .security-notice {
          padding: 20px;
          border-left: 5px solid var(--security-accent);
          border-radius: 8px;
          background: var(--security-soft);
        }

        .security-notice p {
          margin-bottom: 0;
        }

        .security-section {
          padding: 28px 0;
          border-bottom: 1px solid var(--security-border);
        }

        .security-section h2,
        .security-contact h2 {
          margin-top: 0;
          font-size: 23px;
          line-height: 1.4;
        }

        .security-section p,
        .security-section li,
        .security-contact p {
          color: var(--security-muted);
        }

        .security-section li {
 
