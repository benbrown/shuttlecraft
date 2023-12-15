/* This module contains the markdown renderer used to format posts

 By default, urls will be linkifies with nofollow, noopener, and noreferrer attributes
 Override those attributes by setting LINK_ATTRIBUTES in the .env file

Usage:
const html = md.render(markdown);

*/

import dotenv from 'dotenv';
import MarkdownIt from 'markdown-it';

dotenv.config();

const md = new MarkdownIt({
  html: true,
  linkify: true
});

const LINK_ATTRIBUTES = process.env.LINK_ATTRIBUTES || 'nofollow noopener noreferrer';

/**
 * The above function modifies the rendering of link tags in Markdown by adding a "rel" attribute with
 * the value of LINK_ATTRIBUTES.
 * @param tokens - The `tokens` parameter is an array of token objects. Each token object represents a
 * part of the Markdown document, such as a paragraph, heading, link, etc. The `tokens` array is passed
 * to the renderer function to generate the corresponding HTML output.
 * @param idx - The `idx` parameter in the code refers to the index of the current token being rendered
 * in the array of tokens.
 * @param options - The `options` parameter is an object that contains various options and
 * configurations for the Markdown renderer. It can include settings such as the rendering mode, the
 * HTML tag names to use for different elements, and other customization options.
 * @param env - The `env` parameter in the code snippet refers to the environment object. It is an
 * optional parameter that can be used to pass additional information or configuration to the rendering
 * rules. It can be used to store and access data that needs to be shared between different rendering
 * rules.
 * @param self - The `self` parameter refers to the Markdown-it instance. It is used to access the
 * `renderToken` method and the `renderer` object, which contains the rules for rendering Markdown
 * tokens.
 *
 * customize the link formatter to include noopener noreferrer links
 * this prevents browsers from telling downstream pages about where the links came from
 * and protects the privacy of our users.
 * code from: https://publishing-project.rivendellweb.net/customizing-markdown-it/
 */
const proxy = (tokens, idx, options, env, self) => self.renderToken(tokens, idx, options);
const defaultLinkOpenRenderer = md.renderer.rules.link_open || proxy;
md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  tokens[idx].attrJoin('rel', LINK_ATTRIBUTES);
  return defaultLinkOpenRenderer(tokens, idx, options, env, self);
};

export { md, LINK_ATTRIBUTES };
