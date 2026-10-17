# AI Agents for AI Strategy: Course Materials

This folder holds an 8-week graduate course about AI agents. The course uses the open lessons of [Microsoft AI Agents for Beginners](https://github.com/microsoft/ai-agents-for-beginners) as its readings and videos. This folder adds the structure that a university course needs: a syllabus, weekly guides, assignments, rubrics, and a capstone project.

The course is for students in the MS in AI Strategy program at Georgia College & State University. It follows CBIS 5530 · Introduction to RAG, and it uses [RAG Lab](https://wrisvold.github.io/rag-lab/) in Week 3.

## Who the course is for

The students are managers and analysts, not software engineers. The course teaches them to design, judge, and govern agents. Students read code but do not have to write it. Each week has an optional code path for students who want to run the Microsoft notebooks.

## Files

| File | Contents |
|---|---|
| [syllabus.md](syllabus.md) | Course description, outcomes, schedule, grades, and policies |
| [glossary.md](glossary.md) | The terms that the course uses, each with one meaning |
| [case-fall-line.md](case-fall-line.md) | The Fall Line case, which all weekly assignments use |
| [week-01.md](week-01.md) | What an agent is, and when not to use one |
| [week-02.md](week-02.md) | Tools and function calling |
| [week-03.md](week-03.md) | Agentic RAG |
| [week-04.md](week-04.md) | Planning and metacognition |
| [week-05.md](week-05.md) | Multi-agent systems and protocols |
| [week-06.md](week-06.md) | Context engineering and memory |
| [week-07.md](week-07.md) | Trust, safety, and security |
| [week-08.md](week-08.md) | Production: observability, evaluation, and cost |
| [capstone.md](capstone.md) | The capstone project: an agent design brief |

## How the weeks map to the Microsoft lessons

The Microsoft course has 18 numbered lessons and a setup lesson, Lesson 00. This course uses 14 lessons as required readings and 3 lessons as optional readings. It does not use the other lesson.

| Week | Required lessons | Optional lessons |
|---|---|---|
| 1 | 01 Intro to AI Agents, 02 Agentic Frameworks, 03 Agentic Design Principles | – |
| 2 | 04 Tool Use | – |
| 3 | 05 Agentic RAG | – |
| 4 | 07 Planning Design, 09 Metacognition (selected sections) | – |
| 5 | 08 Multi-Agent, 11 Agentic Protocols | 14 Microsoft Agent Framework |
| 6 | 12 Context Engineering, 13 Agent Memory | – |
| 7 | 06 Trustworthy Agents, 18 Securing AI Agents (selected sections) | – |
| 8 | 10 Agents in Production | 16 Deploying Scalable Agents, 17 Local AI Agents |

The course does not use Lesson 00 (Course Setup) as a reading. Students on the optional code path use it. The course does not use Lesson 15 (Computer Use Agents).

Weeks 1, 6, 7, and 8 also give optional readings from [LangGraph](https://github.com/langchain-ai/langgraph), a second agent framework. These readings show that the ideas of the course apply to more than one framework. Students do not write LangGraph code.

## The writing standard

All text in this folder follows the rules of ASD-STE100 Simplified Technical English, Issue 9. The rules make text easier to read for students who use English as a second language. The rules also make text easier to translate.

These are the rules that the text applies:

- Each sentence has one idea.
- Each instruction has 20 words or fewer. Each description sentence has 25 words or fewer.
- Sentences use the active voice and simple tenses.
- The text does not use semicolons or phrasal verbs.
- Each term has one meaning. The [glossary](glossary.md) gives each term and its meaning.

The writers did not check each word against the official STE dictionary. The text follows the structural rules of the standard. It applies the word rules as a guide only.

When you add or change text, use the same rules. Write new terms in the glossary.

## The source course and its license

Microsoft publishes AI Agents for Beginners under the MIT License. This folder links to the Microsoft lessons and does not copy them. The weekly guides quote short items from the lessons, such as names of patterns and threats.

The Microsoft course changes often. These guides agree with commit `05dd889` of the Microsoft repository, dated 16 October 2026. Before each term, examine the Microsoft lessons for changes. Then update the reading lists.

The Fall Line Supply Company is fictional. It comes from the sample document in RAG Lab (`data/sample.txt`).
