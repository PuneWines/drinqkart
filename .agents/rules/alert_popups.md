# User Rule: Alert Behavior

Whenever the user says "show alert" or asks to display an alert, always create a visual modal / dialog / popup component for the alert rather than using native browser `alert()` or inline text notices.

### Guidelines:
- Render a styled popup modal / dialog (with backdrop blur, clear title, message, status icon, and dismiss/action buttons).
- Ensure it is accessible, responsive, and seamlessly integrates with the application's design system.
