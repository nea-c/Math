data remove storage math: error
data modify storage math:comparison validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:comparison {validation_a:0.0f} run return run function math:internal/invalid_number
data modify storage math:comparison validation_b set compute default math:internal/comparison/finite/b
execute unless data storage math:comparison {validation_b:0.0f} run return run function math:internal/invalid_number
data modify storage math:internal x set from storage math: a
data modify storage math:internal y set from storage math: b
data modify storage math: ans set compute default math:common/arithmetic/add
return 1
