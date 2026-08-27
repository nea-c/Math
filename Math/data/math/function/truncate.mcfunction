data remove storage math: error
execute unless predicate math:internal/finite/a run data remove storage math: ans
execute unless predicate math:internal/finite/a run data modify storage math: error set value "invalid_number"
execute unless predicate math:internal/finite/a run return fail
data modify storage math:internal x set from storage math: a
function math:internal/truncate_x
data modify storage math: ans set compute default math:common/input/z
return 1
