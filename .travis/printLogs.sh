#!/bin/bash

# ---------------------------------------------------------------------------------------------
#  Copyright (c) Microsoft Corporation. All rights reserved.
#  Licensed under the MIT License. See License.txt in the project root for license information.
# --------------------------------------------------------------------------------------------

fold_start() {
  echo -e "travis_fold:start:$1\033[33;1m$2\033[0m"
}

fold_end() {
  echo -e "\ntravis_fold:end:$1\r"
}

fold_start testLogs "Test Logs"

for f in ./.logs/*.log
do
  fold_start logFile $f
  cat $f
  fold_end logFile
done

fold_end testLogs
