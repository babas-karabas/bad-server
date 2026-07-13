import sanitizeHtml from 'sanitize-html';

const options = {
  allowedTags: [],
}

export const sanitize = (data: string) => sanitizeHtml(data, options)
