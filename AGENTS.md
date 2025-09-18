# Coding rules

**DO NOT START IMPLEMENTING ANYTHING UNLESS I TELL YOU TO DO SO.**
Do not begin implementation when I'm only asking questions or requesting a review; wait for my explicit confirmation.

1. Make changes **precisely targeted** to the requested area. All other unrelated code must remain absolutely untouched.

2. Do **not** break any previously working logic — including UI styles, element positions, behaviors, or existing functionalities.

3. Write clean, modular, well-structured, highly maintainable, and easy-to-understand code. Avoid unnecessary complexity.

4. Follow the best practices of the language/framework you use (e.g., React, TypeScript, Three.js). Where functionality matches patterns used in professional/industrial software, prefer those established practices.

5. Prefer small changes when possible. If a larger or moderate change is required to avoid a temporary/fragile fix or to preserve long-term quality, make it and explain why it was necessary.

6. After making changes, briefly tell me **what to test**.

7. Always perform a code review and run lint checks after making changes.

8. Follow my instructions strictly and do not make assumptions. If something is unclear, ask questions before proceeding.

9. If you are unsure about anything, **do not proceed** — ask for clarification and ensure you fully understand the requirements.

10. I may have made changes to the code after your changes. Do not revert code to a previous version unless I explicitly tell you to or it is absolutely necessary, instead, you should understand my intention first; if you revert, explain why.

11. If the task is moderately complex, present a short TODO list first, then implement step-by-step.

12. When modifying a file, pay attention to its imports, dependencies, and the potential effects on other modules.

13. New code must adhere to the existing formatting and coding style.

14. Avoid overly verbose comments. Comment only on critical, non-obvious code, specific needs, or known workarounds.

15. Avoid uncommon tricks or flashy constructs. Prefer clear, conventional solutions.

16. Avoid abusing patterns like indiscriminate `try/catch`. Avoid discouraged practices (e.g., `any` type, `React.FC`) unless there is a justified reason and you explain it.

17. Be careful when using `useEffect` and other advanced React hooks — they can introduce loops or unwanted mounts. Use them when appropriate and document why.
