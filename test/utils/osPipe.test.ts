import { describe, expect, test } from "bun:test";
import * as fs from "fs";

import { createPipe } from "../../app/utils/osPipe";

describe("createPipe", () => {
  test("data written to the write end can be read from the read end", () => {
    const [read, write] = createPipe();
    fs.writeSync(write, "hello");
    fs.closeSync(write);

    const buffer = Buffer.alloc(16);
    const n = fs.readSync(read, buffer);
    expect(buffer.toString("utf8", 0, n)).toBe("hello");
    expect(fs.readSync(read, buffer)).toBe(0); // EOF once the writer closed
    fs.closeSync(read);
  });

  test("the read end is blocking, not inherited O_NONBLOCK", () => {
    const [read, write] = createPipe();
    fs.closeSync(write);
    // A non-blocking fd would throw EAGAIN here instead of returning EOF.
    expect(fs.readSync(read, Buffer.alloc(1))).toBe(0);
    fs.closeSync(read);
  });
});
