import { render } from 'solid-js/web';
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import { attachDevtoolsOverlay } from '@solid-devtools/overlay';
import './index.css';
import App from './App';

attachDevtoolsOverlay();

const root = document.getElementById('root');
if (root) {
  render(() => <App />, root);
}
