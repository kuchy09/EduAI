const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

const errorBoundary = `
import React from 'react';
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red' }}>
          <h1>Something went wrong.</h1>
          <pre>{this.state.error.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
`;

code = code.replace("import App from './App.tsx';", errorBoundary + "\nimport App from './App.tsx';");
code = code.replace("<App />", "<ErrorBoundary><App /></ErrorBoundary>");

fs.writeFileSync('src/main.tsx', code);
console.log("Patched main.tsx with ErrorBoundary");
