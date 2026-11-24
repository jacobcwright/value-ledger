// Redirects www.valueforhumanity.com to the apex domain, keeping path, query and hash-less URL parts.
export default {
  fetch(request) {
    const url = new URL(request.url);
    url.hostname = "valueforhumanity.com";
    url.protocol = "https:";
    url.port = "";
    return Response.redirect(url.toString(), 301);
  }
};
