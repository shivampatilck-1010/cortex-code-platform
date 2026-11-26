import type { Challenge } from './challenges-data';
import { getLanguageConfig } from '@/config/languages';

/**
 * Full set of executable programming languages available for DSA & Programming
 * practice challenges (stdin -> stdout evaluation via Judge0 CE / Local Sandbox).
 */
export const PRACTICE_EXECUTABLE_LANGUAGES: string[] = [
  'python',
  'cpp',
  'c',
  'java',
  'javascript',
  'typescript',
  'csharp',
  'go',
  'rust',
  'kotlin',
  'swift',
  'php',
  'ruby',
  'dart',
  'scala',
  'haskell',
  'elixir',
  'fsharp',
  'r',
  'bash',
  'lua',
  'perl',
];

function extractInputHints(challenge: Challenge): string[] {
  const py = challenge.starterTemplates?.python || '';
  const hints: string[] = [];
  for (const line of py.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      hints.push(trimmed.replace(/^#+\s*/, ''));
    } else if (trimmed.length > 0) {
      break;
    }
  }
  return hints.length > 0 ? hints : [`${challenge.title} (${challenge.difficulty})`];
}

function commentHeader(prefix: string, lines: string[]): string {
  return lines.map((l) => `${prefix} ${l}`).join('\n');
}

/**
 * Returns the ordered list of selectable language IDs for a given challenge.
 */
export function getChallengeLanguages(challenge: Challenge): string[] {
  if (challenge.track === 'SQL') {
    return ['sql'];
  }
  const extra = Object.keys(challenge.starterTemplates).filter(
    (k) => k !== 'sql' && !PRACTICE_EXECUTABLE_LANGUAGES.includes(k)
  );
  return [...PRACTICE_EXECUTABLE_LANGUAGES, ...extra];
}

/**
 * Resolves starter code for any supported language on a challenge, returning
 * hand-authored starterTemplates when present and idiomatic stdin/stdout
 * boilerplate for every other executable language.
 */
export function getChallengeStarterTemplate(challenge: Challenge, langId: string): string {
  if (challenge.starterTemplates[langId]) {
    return challenge.starterTemplates[langId];
  }

  const hints = extractInputHints(challenge);
  const slashHeader = commentHeader('//', hints);
  const hashHeader = commentHeader('#', hints);
  const dashHeader = commentHeader('--', hints);

  switch (langId) {
    case 'java':
      return `${slashHeader}
import java.io.*;
import java.util.*;

class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
            sb.append(line).append('\\n');
        }
        String input = sb.toString().trim();
        // TODO: Solve ${challenge.title} and print result
    }
}
`;
    case 'typescript':
      return `${slashHeader}
import * as fs from 'fs';

const lines: string[] = fs.readFileSync(0, 'utf-8').trim().split('\\n');
// TODO: Solve ${challenge.title} and print result via console.log(...)
`;
    case 'c':
      return `${slashHeader}
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(void) {
    char buf[4096];
    while (fgets(buf, sizeof(buf), stdin) != NULL) {
        /* TODO: Parse input and solve ${challenge.title} */
    }
    return 0;
}
`;
    case 'csharp':
      return `${slashHeader}
using System;
using System.Collections.Generic;
using System.Linq;

class Program {
    static void Main() {
        string input = Console.In.ReadToEnd().Trim();
        // TODO: Solve ${challenge.title} and write output via Console.WriteLine(...)
    }
}
`;
    case 'go':
      return `${slashHeader}
package main

import (
\t"bufio"
\t"fmt"
\t"os"
\t"strings"
)

func main() {
\tscanner := bufio.NewScanner(os.Stdin)
\tvar lines []string
\tfor scanner.Scan() {
\t\tlines = append(lines, strings.TrimSpace(scanner.Text()))
\t}
\t_ = lines
\t_ = fmt.Println
\t// TODO: Solve ${challenge.title} and print result
}
`;
    case 'rust':
      return `${slashHeader}
use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let lines: Vec<&str> = input.trim().lines().collect();
    let _ = lines;
    // TODO: Solve ${challenge.title} and print result via println!(...)
}
`;
    case 'kotlin':
      return `${slashHeader}
fun main() {
    val lines = generateSequence(::readLine).toList()
    // TODO: Solve ${challenge.title} and print result via println(...)
}
`;
    case 'swift':
      return `${slashHeader}
import Foundation

var lines: [String] = []
while let line = readLine() {
    lines.append(line)
}
// TODO: Solve ${challenge.title} and print result via print(...)
`;
    case 'php':
      return `<?php
${slashHeader}
$input = trim(stream_get_contents(STDIN));
$lines = $input === '' ? [] : explode("\\n", $input);
// TODO: Solve ${challenge.title} and print result via echo
`;
    case 'ruby':
      return `${hashHeader}
lines = STDIN.read.strip.split("\\n")
# TODO: Solve ${challenge.title} and print result via puts
`;
    case 'dart':
      return `${slashHeader}
import 'dart:io';

void main() {
  final lines = <String>[];
  String? line;
  while ((line = stdin.readLineSync()) != null) {
    lines.add(line!);
  }
  // TODO: Solve ${challenge.title} and print result via print(...)
}
`;
    case 'scala':
      return `${slashHeader}
import scala.io.Source

@main def run(): Unit =
  val lines = Source.stdin.getLines().toList
  // TODO: Solve ${challenge.title} and print result via println(...)
`;
    case 'haskell':
      return `${dashHeader}
module Main where

main :: IO ()
main = do
  contents <- getContents
  let ls = lines contents
  -- TODO: Solve ${challenge.title} and print result via putStrLn
  pure ()
`;
    case 'elixir':
      return `${hashHeader}
lines = IO.stream(:stdio, :line) |> Enum.map(&String.trim_trailing(&1, "\\n"))
_ = lines
# TODO: Solve ${challenge.title} and print result via IO.puts
`;
    case 'fsharp':
      return `${slashHeader}
open System

[<EntryPoint>]
let main _ =
    let input = Console.In.ReadToEnd().Trim()
    // TODO: Solve ${challenge.title} and print result via printfn
    0
`;
    case 'r':
      return `${hashHeader}
lines <- readLines(file("stdin"))
# TODO: Solve ${challenge.title} and print result via cat(...)
`;
    case 'bash':
      return `#!/bin/bash
${hashHeader}
mapfile -t lines
# TODO: Solve ${challenge.title} and print result via echo
`;
    case 'lua':
      return `${dashHeader}
local input = io.read("*a")
-- TODO: Solve ${challenge.title} and print result via print(...)
`;
    case 'perl':
      return `#!/usr/bin/perl
${hashHeader}
use strict;
use warnings;
my @lines = <STDIN>;
chomp @lines;
# TODO: Solve ${challenge.title} and print result via print
`;
    default: {
      const cfg = getLanguageConfig(langId);
      return cfg.starterCode || '';
    }
  }
}
