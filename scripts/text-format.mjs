// Text formatting rules shared by the scripts.
//
// The repository keeps one line ending rule, so a file written on Windows and a
// file written on the Linux runner cannot drift apart. Text files are stored in
// the repository with LF and are checked out with CRLF, and the files this
// project writes are written with CRLF. That is why `git add` stays quiet
// instead of warning that LF will be replaced by CRLF.
export const EOL = '\r\n';

// Normalises any mix of endings into one ending.
export const toEol = (text, eol = EOL) => text.replace(/\r\n/g, '\n').replace(/\n/g, eol);

// JSON as it is written to disk: two space indent, CRLF endings, one trailing
// newline, no BOM.
export const jsonText = value => toEol(`${JSON.stringify(value, null, 2)}\n`);
