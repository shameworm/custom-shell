import { spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Creates an OS pipe and returns its [read, write] file descriptors.
//
// Node and Bun have no pipe() call, and Bun can't pass one child's stdout
// stream to another child yet. Copying the data through the shell would
// also break SIGPIPE: `yes | head -1` would never end. So a named pipe is
// created, both ends are opened, and the name is removed, which leaves an
// ordinary anonymous pipe.
//
// The read end is first opened non-blocking, so opening the write end
// doesn't wait for a reader. A blocking read end is then opened and the
// probe closed, because children would inherit O_NONBLOCK and fail with
// EAGAIN.
export function createPipe(): [read: number, write: number] {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shell-pipe-"));
  const fifo = path.join(dir, "fifo");
  try {
    const made = spawnSync("mkfifo", [fifo]);
    if (made.status !== 0) throw new Error("mkfifo failed");

    const { O_RDONLY, O_WRONLY, O_NONBLOCK } = fs.constants;
    const probe = fs.openSync(fifo, O_RDONLY | O_NONBLOCK);
    const write = fs.openSync(fifo, O_WRONLY);
    const read = fs.openSync(fifo, O_RDONLY);
    fs.closeSync(probe);
    return [read, write];
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
