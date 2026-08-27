data remove storage math: error
data modify storage math:comparison validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:comparison {validation_a:0.0f} run return run function math:internal/invalid_number
data modify storage math:internal x set from storage math: a
function math:internal/truncate_x
data modify storage math: ans set compute default math:common/input/z
return 1
