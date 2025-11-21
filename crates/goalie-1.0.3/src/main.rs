use clap::{Arg, Command};
use std::process::{Command as ProcessCommand, Stdio};
use anyhow::Result;

fn main() -> Result<()> {
    let _matches = Command::new("goalie")
        .version("1.0.1")
        .about("AI-powered research assistant using Goal-Oriented Action Planning")
        .long_about("Rust wrapper for the npm goalie package. This binary forwards all commands to 'npx goalie'.")
        .subcommand_required(false)
        .arg_required_else_help(false)
        .allow_external_subcommands(true)
        .arg(
            Arg::new("help")
                .short('h')
                .long("help")
                .action(clap::ArgAction::Help)
                .help("Print help information")
        )
        .arg(
            Arg::new("version")
                .short('V')
                .long("version")
                .action(clap::ArgAction::Version)
                .help("Print version information")
        )
        .get_matches();

    // Collect all arguments passed to this binary
    let args: Vec<String> = std::env::args().collect();

    // Skip the first argument (the binary name) and pass the rest to npx goalie
    let mut npx_args = vec!["npx".to_string(), "--yes".to_string(), "goalie@1.0.1".to_string()];

    if args.len() > 1 {
        npx_args.extend(args[1..].iter().cloned());
    } else {
        // If no arguments provided, show help
        npx_args.push("--help".to_string());
    }

    // Execute npx goalie with the provided arguments
    let mut cmd = ProcessCommand::new(&npx_args[0]);
    cmd.args(&npx_args[1..])
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());

    let status = cmd.status()?;

    std::process::exit(status.code().unwrap_or(1));
}
