# Syllabus: AI Agents for AI Strategy

| Item | Details |
|---|---|
| Program | MS in AI Strategy, Georgia College & State University |
| Course number | To be set by the department |
| Format | 8 weeks, online. Each week has readings, videos, a discussion, and an assignment. |
| Instructor | Ward Risvold |
| Recommended preparation | CBIS 5530 · Introduction to RAG |
| Writing standard | ASD-STE100 Simplified Technical English. See the [course README](README.md). |

> **Instructor:** Items in this syllabus marked "Default" are suggestions. Change them before the term starts.

## Course description

An AI agent is a system that uses a model, tools, and knowledge to do a task in steps. The model decides each next step. Agents can find data, make plans, and do actions in business systems. They can also make errors that a chatbot cannot make, because they act.

This course teaches students to design, judge, and govern agents. Students learn the main agent patterns: tool use, agentic RAG, planning, multi-agent systems, context engineering, and memory. Students also learn how to make agents safe, how to measure them, and how to control their cost.

The readings come from the free Microsoft course AI Agents for Beginners. All assignments use one business case, the Fall Line Supply Company. In the capstone, each student writes an agent design brief. A technical team can build from the brief, and a manager can approve it.

Students read code in this course, but they do not have to write code.

## Learning outcomes

After this course, a student can:

1. Explain what an agent is. Identify tasks for which an agent is the correct solution, and tasks for which it is not.
2. Specify the tools of an agent, with a schema, a permission level, and an approval rule for each tool.
3. Design an agentic RAG loop that has a check step and a stop condition.
4. Break a business goal into a plan. Select a single-agent design or a multi-agent design, and give reasons.
5. Write a context policy and a memory policy for an agent.
6. Identify threats to an agent and specify controls for them, including human approval.
7. Write an evaluation plan with offline tests, online metrics, and cost limits.
8. Write an agent design brief for a real business problem.

## Materials

All materials are free.

- **The Microsoft course.** [AI Agents for Beginners](https://github.com/microsoft/ai-agents-for-beginners). Each lesson has a written text and, for most lessons, a video. Each weekly guide tells you which parts to read.
- **RAG Lab.** [The RAG Lab simulator](https://wrisvold.github.io/rag-lab/), which you used in CBIS 5530. You use it again in Week 3.
- **LangGraph (optional).** [LangGraph](https://github.com/langchain-ai/langgraph) is a second agent framework, from LangChain. Some weeks give its documentation as optional reading.
- **The Fall Line case.** [case-fall-line.md](case-fall-line.md). Read it in Week 1.

## How each week works

Each week has a guide. The guide gives the parts in this sequence:

1. **Objectives.** What you can do after the week.
2. **Read and watch.** The lessons and videos for the week.
3. **Key ideas.** A short summary of the main ideas.
4. **Discussion.** A question for the class discussion board.
5. **Assignment.** A task on the Fall Line case, with a rubric.
6. **Optional code path.** Steps for students who want to examine or run the Microsoft notebooks.

## Schedule

| Week | Topic | Microsoft lessons | Due |
|---|---|---|---|
| 1 | What an agent is, and when not to use one | 01, 02, 03 | Discussion 1, Assignment 1 |
| 2 | Tools and function calling | 04 | Discussion 2, Assignment 2 |
| 3 | Agentic RAG | 05 | Discussion 3, Assignment 3 |
| 4 | Planning and metacognition | 07, 09 | Discussion 4, Assignment 4, capstone proposal |
| 5 | Multi-agent systems and protocols | 08, 11 | Discussion 5, Assignment 5 |
| 6 | Context engineering and memory | 12, 13 | Discussion 6, Assignment 6 |
| 7 | Trust, safety, and security | 06, 18 | Discussion 7, Assignment 7 |
| 8 | Production: observability, evaluation, and cost | 10 | Capstone brief, capstone presentation |

Default: Discussions are due on Wednesday at 11:59 p.m. Replies to two classmates are due on Sunday at 11:59 p.m. Assignments are due on Sunday at 11:59 p.m.

## Grades

| Item | Number | Weight of each | Total |
|---|---|---|---|
| Weekly assignments (Weeks 1 to 7) | 7 | 8% | 56% |
| Discussions (Weeks 1 to 7) | 7 | 2% | 14% |
| Capstone proposal (Week 4) | 1 | 5% | 5% |
| Capstone brief (Week 8) | 1 | 20% | 20% |
| Capstone presentation (Week 8) | 1 | 5% | 5% |
| **Total** | | | **100%** |

Default grade scale: A is 90% or more. B is 80% to 89%. C is 70% to 79%. F is less than 70%.

Each assignment has a rubric with a total of 100 points. The weekly guide gives the rubric.

### Discussions

Each discussion has two parts:

1. Write a first post of 200 to 300 words. Answer the question in the weekly guide.
2. Reply to two classmates. In each reply, add one new fact, example, or risk. Do not only agree.

Default: A first post earns 60% of the discussion grade. The two replies earn 40%.

## Policies

### Late work

Default: A late assignment loses 10% of its points for each day. After three days, the instructor does not accept it. The capstone brief has no late period. Speak to the instructor before the due date if you have a problem.

### Use of AI tools

This course is about AI, and you can use AI tools in your work. These rules apply:

1. Write a short statement at the end of each assignment. Tell which AI tools you used and for what.
2. Check every fact that an AI tool gives you. You are responsible for the accuracy of your work.
3. Do not put confidential data from your employer into a public AI tool.

The Fall Line handbook has the same rule for its staff (Section 5.3). The course uses this rule as an example in Week 7.

### The optional code path

You do not have to run code to pass this course. If you want to run the Microsoft notebooks, read Lesson 00 (Course Setup) first.

Most Microsoft notebooks use Microsoft Foundry and Azure OpenAI. You need an Azure account for them, and Azure can charge you for the models. Lesson 00 also describes Foundry Local, which runs models on your own computer. Some notebooks may not run with Foundry Local, because it does not give the full Responses API.

Set a spending limit in your Azure account before you run a notebook. Delete your Azure resources at the end of the course.

### University policies

> **Instructor:** Insert the standard GCSU syllabus statements here: academic honesty, accessibility and accommodations, student rights, and the withdrawal date.
