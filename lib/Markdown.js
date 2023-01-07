/* This module contains the markdown renderer used to format posts

 By default, urls will be linkified with nofollow noopener and noreferrer attributes
 Override those attributes by setting LINK_ATTRIBUTES in the .env file

Usage:
const html = md.render(markdown);

*/

import dotenv from 'dotenv';
dotenv.config();
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
    html: true,
    linkify: true,
});

const LINK_ATTRIBUTES = process.env.LINK_ATTRIBUTES || "nofollow noopener noreferrer"

// customize the link formatter to include noopener noreferrer links
// this prevents browsers from telling downstream pages about where the links came from
// and protects the privacy of our users.
// code from: https://publishing-project.rivendellweb.net/customizing-markdown-it/
const proxy = (tokens, idx, options, env, self) => self.renderToken(tokens, idx, options);
const defaultLinkOpenRenderer = md.renderer.rules.link_open || proxy;
md.renderer.rules.link_open = function(tokens, idx, options, env, self) {
    tokens[idx].attrJoin("rel", LINK_ATTRIBUTES);
    return defaultLinkOpenRenderer(tokens, idx, options, env, self)
  };

export { md, LINK_ATTRIBUTES };