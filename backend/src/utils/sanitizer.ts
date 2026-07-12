import sanitizeHtml from 'sanitize-html';

const options = {
  allowedTags: [],
  allowedAttributes: [],
  removeInvalidAttr: true,
  removeScript: true,
  removeStyle: true
}

export const sanitizeHTML = (data: unknown) => sanitizeHtml(data, options)
