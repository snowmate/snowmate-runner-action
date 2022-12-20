import * as core from '@actions/core';

const time = (new Date()).toTimeString();
core.setOutput("outputName", time);
