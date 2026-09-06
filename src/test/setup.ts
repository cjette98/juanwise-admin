import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only registers this itself when Vitest runs with `globals`,
// which this project does not — without it each render is left in the document
// and the next query finds two of everything.
afterEach(cleanup);

/**
 * jsdom implements the <dialog> element but not `showModal`/`close`, so a
 * component that calls them throws before rendering anything. These stand-ins
 * toggle the `open` property, which is what the tests actually assert on.
 */
const proto = window.HTMLDialogElement?.prototype;

if (proto) {
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  proto.show = function show(this: HTMLDialogElement) {
    this.open = true;
  };
  proto.close = function close(this: HTMLDialogElement, returnValue?: string) {
    this.open = false;
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.dispatchEvent(new Event('close'));
  };
}
