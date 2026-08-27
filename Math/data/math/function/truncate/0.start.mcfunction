data remove storage math: error
data modify storage math:internal w_validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:internal {w_validation_a:0.0f} run return run function math:.common/invalid_number/0.start
data modify storage math:internal x set from storage math: a
function math:.common/truncate/0.start
data modify storage math: ans set compute default math:common/input/z
return 1
