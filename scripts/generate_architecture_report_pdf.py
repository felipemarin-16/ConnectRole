from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


OUTPUT_DIR = Path("/Users/felipemarin/Desktop/ConnectRole/artifacts")
PDF_PATH = OUTPUT_DIR / "connectrole-architecture-and-growth-plan.pdf"

BLUE = colors.HexColor("#2E74B5")
DARK = colors.HexColor("#1F2D3D")
MUTED = colors.HexColor("#5F6B7A")
LIGHT = colors.HexColor("#F4F6F9")
TABLE_HEAD = colors.HexColor("#E8EEF5")
GRID = colors.HexColor("#C8D2DC")


def styles():
    sample = getSampleStyleSheet()
    return {
        "kicker": ParagraphStyle(
            "Kicker",
            parent=sample["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=13,
            textColor=BLUE,
            alignment=TA_CENTER,
            spaceAfter=8,
            tracking=0.5,
        ),
        "title": ParagraphStyle(
            "TitleCustom",
            parent=sample["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=DARK,
            alignment=TA_CENTER,
            spaceAfter=8,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=sample["Normal"],
            fontName="Helvetica",
            fontSize=11.2,
            leading=15,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceAfter=12,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=13.2,
            textColor=DARK,
            alignment=TA_LEFT,
            spaceAfter=6,
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=sample["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=17,
            textColor=BLUE,
            alignment=TA_LEFT,
            spaceBefore=8,
            spaceAfter=6,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=sample["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11.6,
            leading=14,
            textColor=BLUE,
            alignment=TA_LEFT,
            spaceBefore=5,
            spaceAfter=4,
        ),
        "bullet": ParagraphStyle(
            "BulletCustom",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=9.8,
            leading=12.8,
            textColor=DARK,
            leftIndent=16,
            firstLineIndent=-10,
            bulletIndent=0,
            spaceAfter=2,
        ),
        "number": ParagraphStyle(
            "NumberCustom",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=9.8,
            leading=12.8,
            textColor=DARK,
            leftIndent=18,
            firstLineIndent=-12,
            spaceAfter=2,
        ),
        "callout": ParagraphStyle(
            "Callout",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=9.9,
            leading=13.2,
            textColor=DARK,
            alignment=TA_LEFT,
            spaceAfter=0,
        ),
        "table": ParagraphStyle(
            "TableText",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=8.9,
            leading=11.2,
            textColor=DARK,
            alignment=TA_LEFT,
        ),
        "table_bold": ParagraphStyle(
            "TableBold",
            parent=sample["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8.9,
            leading=11.2,
            textColor=DARK,
            alignment=TA_LEFT,
        ),
    }


def p(text, style):
    return Paragraph(text, style)


def bullet_list(items, bullet_style):
    return [Paragraph(f"&bull; {item}", bullet_style) for item in items]


def number_list(items, number_style):
    return [Paragraph(f"{idx}. {item}", number_style) for idx, item in enumerate(items, start=1)]


def make_table(data, col_widths, table_style):
    table = Table(data, colWidths=col_widths, hAlign="LEFT")
    table.setStyle(table_style)
    return table


def base_table_style(with_header=False):
    commands = [
        ("GRID", (0, 0), (-1, -1), 0.6, GRID),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if with_header:
        commands.append(("BACKGROUND", (0, 0), (-1, 0), TABLE_HEAD))
    return TableStyle(commands)


def add_page_frame(canvas, doc):
    canvas.saveState()
    width, height = LETTER
    canvas.setStrokeColor(colors.HexColor("#D6DEE8"))
    canvas.setLineWidth(0.8)
    canvas.line(doc.leftMargin, height - 0.72 * inch, width - doc.rightMargin, height - 0.72 * inch)
    canvas.setFont("Helvetica", 9)
    canvas.setFillColor(MUTED)
    canvas.drawString(doc.leftMargin, 0.55 * inch, "ConnectRole architecture brief")
    canvas.drawRightString(width - doc.rightMargin, 0.55 * inch, f"Page {canvas.getPageNumber()}")
    canvas.restoreState()


def build_story():
    s = styles()
    story = []

    story.append(Spacer(1, 1.15 * inch))
    story.append(p("Architecture Brief", s["kicker"]))
    story.append(p("ConnectRole", s["title"]))
    story.append(
        p(
            "Current system architecture, data flow, and a practical roadmap toward a production-ready cloud platform",
            s["subtitle"],
        )
    )

    cover_meta = [
        [p("<b>Prepared for</b>", s["table_bold"]), p("Felipe Marin", s["table"])],
        [
            p("<b>Project</b>", s["table_bold"]),
            p("AI mock interview coach built with Next.js, TypeScript, LLM APIs, and browser voice tooling", s["table"]),
        ],
        [
            p("<b>Purpose</b>", s["table_bold"]),
            p(
                "Summarize the current architecture and outline the next infrastructure investments that would strengthen both the product and the resume story",
                s["table"],
            ),
        ],
        [
            p("<b>Recommended direction</b>", s["table_bold"]),
            p("PostgreSQL + Prisma + AWS-first deployment, with Azure as a strong secondary path", s["table"]),
        ],
    ]
    cover_table = make_table(cover_meta, [1.5 * inch, 5.0 * inch], base_table_style())
    cover_table.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, -1), TABLE_HEAD)]))
    story.append(cover_table)
    story.append(Spacer(1, 0.16 * inch))

    callout = make_table(
        [[
            p(
                "This document is written as a planning memo rather than a formal specification. The goal is to explain how ConnectRole works today, where the architecture is still prototype-oriented, and which backend and cloud additions would make the project feel much closer to something a company would run in production.",
                s["callout"],
            )
        ]],
        [6.5 * inch],
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.7, GRID),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        ),
    )
    story.append(callout)
    story.append(PageBreak())

    story.append(p("1. What ConnectRole is today", s["h1"]))
    for text in [
        "ConnectRole is currently a polished product prototype with a light backend. The user experience is strong: the app accepts a resume, parses a target job posting, generates interview questions, scores spoken answers, and produces a final report. Architecturally, though, the application is still closer to an advanced single-session workflow than a full production system.",
        "The frontend is built in Next.js with the App Router, and most of the experience lives in three client-driven screens: setup, interview, and results. On the server side, API routes provide narrow services such as parsing setup inputs, generating opening questions, evaluating interview turns, summarizing the session, and calling Google Cloud Text-to-Speech. The intelligence layer lives in reusable modules under the lib directory, which keeps the project organized and makes the business logic easier to evolve.",
    ]:
        story.append(p(text, s["body"]))

    story.append(p("Current functional layers", s["h2"]))
    story.extend(
        bullet_list(
            [
                "Presentation layer: React components guide the user through resume upload, interview practice, and results review.",
                "Application layer: Next.js API routes receive structured requests from the browser and return parsed or generated data.",
                "Intelligence layer: helper modules handle resume parsing, job parsing, question generation, turn evaluation, and report creation.",
                "External services: the project already communicates with LLM providers and Google Cloud Text-to-Speech.",
            ],
            s["bullet"],
        )
    )
    story.append(Spacer(1, 0.07 * inch))
    story.append(p("Why this is a good starting point", s["h2"]))
    story.append(
        p(
            "From a hiring perspective, the existing app already shows real product thinking. It is not just a static portfolio site. It has a multi-step flow, API usage, typed data models, state transitions, and user-facing feedback logic. That gives it a strong base. The next leap is to turn the current transient workflow into a persistent, cloud-backed platform.",
            s["body"],
        )
    )
    story.append(p("Core files that define the system", s["h2"]))
    core_files = make_table(
        [
            [p("<b>Setup flow</b>", s["table_bold"]), p("components/setup-screen.tsx and app/api/setup/parse/route.ts", s["table"])],
            [p("<b>Interview flow</b>", s["table_bold"]), p("components/interview-screen.tsx and app/api/interview/turn/route.ts", s["table"])],
            [p("<b>Results flow</b>", s["table_bold"]), p("components/results-screen.tsx and app/api/interview/summary/route.ts", s["table"])],
            [p("<b>Session storage</b>", s["table_bold"]), p("lib/session.ts", s["table"])],
            [p("<b>AI orchestration</b>", s["table_bold"]), p("lib/setup-intelligence.ts, lib/interview-brain.ts, and lib/interview-engine.ts", s["table"])],
        ],
        [2.0 * inch, 4.5 * inch],
        base_table_style(),
    )
    core_files.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, -1), TABLE_HEAD)]))
    story.append(core_files)

    story.append(p("2. How data moves through the system", s["h1"]))
    for text in [
        "The current data flow is straightforward and easy to reason about. During setup, the browser extracts text from a PDF resume, gathers job-posting text from the user, and sends both payloads to a server route. The server parses and enriches those inputs, then returns structured resume and job objects. At that point, the browser becomes the main holder of state.",
        "The interview page loads that saved setup data, asks questions, captures answers, and sends each turn to the evaluation route. The server evaluates the latest answer using the full client-supplied context, then returns the next question and coaching feedback. Finally, the results page assembles a final report, asks the server for a summary, and stores the completed report in the browser as well.",
    ]:
        story.append(p(text, s["body"]))

    story.append(p("Current state ownership", s["h2"]))
    state_table = make_table(
        [
            [p("<b>Stage</b>", s["table_bold"]), p("<b>Where data is created</b>", s["table_bold"]), p("<b>Where data lives after creation</b>", s["table_bold"])],
            [p("Setup", s["table"]), p("Browser + /api/setup/parse", s["table"]), p("sessionStorage in the browser", s["table"])],
            [p("Interview turns", s["table"]), p("Browser + /api/interview/turn", s["table"]), p("sessionStorage in the browser", s["table"])],
            [p("Results", s["table"]), p("Browser + /api/interview/summary", s["table"]), p("sessionStorage in the browser", s["table"])],
            [p("Voice output", s["table"]), p("/api/tts", s["table"]), p("Returned directly as audio bytes", s["table"])],
        ],
        [1.35 * inch, 2.35 * inch, 2.8 * inch],
        base_table_style(with_header=True),
    )
    story.append(state_table)
    story.append(Spacer(1, 0.08 * inch))
    story.append(p("What this means in practice", s["h2"]))
    story.extend(
        bullet_list(
            [
                "The app behaves well for one session on one device.",
                "There is no durable interview history if the tab is lost or the user changes devices.",
                "There is no server-side source of truth, so analytics and user accounts would be hard to add cleanly later.",
                "The client sends large context payloads repeatedly, which is acceptable for a prototype but not ideal for scale.",
            ],
            s["bullet"],
        )
    )
    story.append(p("Most important architectural gap", s["h2"]))
    story.append(
        p(
            "The largest gap is not the lack of a cloud provider by itself. It is the lack of persistence and ownership boundaries. Right now, the browser effectively owns interview state. In a production system, the server should own interview sessions and the database should preserve them. Once that shift happens, cloud infrastructure starts to make much more sense because there is a real backend to host, monitor, protect, and scale.",
            s["body"],
        )
    )

    story.append(p("3. Recommended target architecture", s["h1"]))
    story.append(
        p(
            "The best near-term architecture for ConnectRole is a server-centered design with PostgreSQL as the durable store, object storage for uploaded files, and managed cloud services for deployment and observability. This does not require a giant rewrite. It is more of a shift in responsibility: moving long-lived state out of sessionStorage and into backend services.",
            s["body"],
        )
    )
    story.append(p("Recommended stack", s["h2"]))
    stack_table = make_table(
        [
            [p("<b>Web application</b>", s["table_bold"]), p("Next.js App Router, keeping the existing frontend and API route structure", s["table"])],
            [p("<b>Database</b>", s["table_bold"]), p("PostgreSQL with Prisma for schema management and typed queries", s["table"])],
            [p("<b>File storage</b>", s["table_bold"]), p("Amazon S3 for resume uploads and future exported reports", s["table"])],
            [p("<b>Authentication</b>", s["table_bold"]), p("Auth.js or Amazon Cognito, depending on how cloud-native you want the story to be", s["table"])],
            [p("<b>Deployment</b>", s["table_bold"]), p("AWS Amplify or a container-based deployment path", s["table"])],
            [p("<b>Monitoring</b>", s["table_bold"]), p("CloudWatch, request logging, and basic error tracking", s["table"])],
        ],
        [2.0 * inch, 4.5 * inch],
        base_table_style(),
    )
    stack_table.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, -1), TABLE_HEAD)]))
    story.append(stack_table)
    story.append(Spacer(1, 0.08 * inch))
    story.append(p("How the improved data model should work", s["h2"]))
    story.extend(
        number_list(
            [
                "A user signs in and starts a new interview preparation session.",
                "The resume PDF is uploaded to object storage and its extracted text is saved in PostgreSQL.",
                "The parsed job posting is stored as a first-class database record rather than only a temporary payload.",
                "Starting an interview creates an interview_session record on the server.",
                "Each answer inserts a new interview_turn row and updates the current server-side session state.",
                "Completing the interview creates a final_report row that can be revisited later.",
            ],
            s["number"],
        )
    )
    story.append(p("Why PostgreSQL is the right database here", s["h2"]))
    story.append(
        p(
            "This project is fundamentally relational. Users own resumes. Resumes and job postings connect to interview sessions. Sessions contain many turns. Sessions also produce one final report. That shape fits PostgreSQL naturally. It is also one of the most common databases employers expect students and new grads to understand, especially when paired with Prisma, SQL, and cloud deployment.",
            s["body"],
        )
    )
    story.append(p("AWS versus Azure", s["h2"]))
    cloud_table = make_table(
        [
            [p("<b>Concern</b>", s["table_bold"]), p("<b>AWS-first path</b>", s["table_bold"]), p("<b>Azure-first path</b>", s["table_bold"])],
            [p("Hosting", s["table"]), p("Amplify or container deployment", s["table"]), p("App Service or Static Web Apps", s["table"])],
            [p("Database", s["table"]), p("RDS for PostgreSQL", s["table"]), p("Azure Database for PostgreSQL", s["table"])],
            [p("Object storage", s["table"]), p("S3", s["table"]), p("Blob Storage", s["table"])],
            [p("Identity", s["table"]), p("Cognito", s["table"]), p("Microsoft Entra", s["table"])],
            [p("Monitoring", s["table"]), p("CloudWatch", s["table"]), p("Application Insights / Azure Monitor", s["table"])],
        ],
        [1.4 * inch, 2.45 * inch, 2.65 * inch],
        base_table_style(with_header=True),
    )
    story.append(cloud_table)
    story.append(Spacer(1, 0.08 * inch))
    story.append(
        p(
            "If only one path is chosen, AWS is the stronger general-purpose choice for this project because it aligns well with full-stack deployment, object storage, and the broader job market. Azure remains a good secondary path, especially for companies built around Microsoft tooling.",
            s["body"],
        )
    )

    story.append(p("4. Improvement roadmap for the next few months", s["h1"]))
    for text in [
        "A good improvement plan should create visible momentum quickly. The goal is not to boil the ocean. It is to turn the project into something that demonstrates backend ownership, database design, deployment maturity, and real cloud familiarity in a sequence that still feels achievable for a senior student.",
    ]:
        story.append(p(text, s["body"]))
    story.append(p("Phase-by-phase plan", s["h2"]))
    phase_table = make_table(
        [
            [p("<b>Phase</b>", s["table_bold"]), p("<b>Main deliverable</b>", s["table_bold"]), p("<b>Why it matters</b>", s["table_bold"])],
            [p("1", s["table"]), p("Prisma + PostgreSQL integration", s["table"]), p("Introduces durable backend state and shows database modeling skill", s["table"])],
            [p("2", s["table"]), p("User authentication", s["table"]), p("Turns anonymous sessions into user-owned history", s["table"])],
            [p("3", s["table"]), p("Resume file storage in S3", s["table"]), p("Adds real cloud storage and separation of file data from relational data", s["table"])],
            [p("4", s["table"]), p("Docker + local compose setup", s["table"]), p("Shows environment reproducibility and deployment readiness", s["table"])],
            [p("5", s["table"]), p("AWS deployment + monitoring", s["table"]), p("Makes the project production-like and resume-ready", s["table"])],
        ],
        [0.8 * inch, 2.35 * inch, 3.35 * inch],
        base_table_style(with_header=True),
    )
    story.append(phase_table)
    story.append(Spacer(1, 0.08 * inch))
    story.append(p("The highest-value implementation order", s["h2"]))
    story.extend(
        bullet_list(
            [
                "Move setup, interview session, and final report persistence from sessionStorage to PostgreSQL.",
                "Introduce an interview session identifier so the browser can reload state from the server.",
                "Store the original PDF file separately from the parsed text and metadata.",
                "Containerize the application so local development and deployment use the same runtime assumptions.",
                "Add a basic CI pipeline that runs linting, type checks, and build validation.",
            ],
            s["bullet"],
        )
    )
    story.append(p("How this helps your resume", s["h2"]))
    story.append(
        p(
            "Employers care less about whether a student merely used buzzwords and more about whether the system design choices make sense. If ConnectRole evolves into a project with PostgreSQL, Docker, object storage, authentication, and a managed AWS deployment, you can talk concretely about tradeoffs: why some data belongs in relational tables, why files belong in object storage, why Docker helps standardize environments, and how cloud services reduce operational burden.",
            s["body"],
        )
    )
    story.append(
        p(
            "That is exactly the kind of conversation that tends to differentiate a candidate who has built projects from a candidate who has only taken classes. The strongest version of this story is not just 'I used AWS.' It is 'I redesigned a client-held prototype into a persistent cloud-backed system and can explain each infrastructure choice.'",
            s["body"],
        )
    )
    story.append(p("Final recommendation", s["h2"]))
    story.append(
        p(
            "The clearest next move is to make ConnectRole a database-backed AWS project. Start with PostgreSQL and Prisma, then add auth, S3, Docker, and deployment. That sequence improves the product, makes the architecture more correct, and gives you several highly marketable skills at once without losing the momentum of the app you already built.",
            s["body"],
        )
    )

    return story


def build_pdf():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(PDF_PATH),
        pagesize=LETTER,
        leftMargin=0.82 * inch,
        rightMargin=0.82 * inch,
        topMargin=0.76 * inch,
        bottomMargin=0.7 * inch,
        title="ConnectRole Architecture and Growth Plan",
        author="OpenAI Codex",
    )
    doc.build(build_story(), onFirstPage=add_page_frame, onLaterPages=add_page_frame)


if __name__ == "__main__":
    build_pdf()
